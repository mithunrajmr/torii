// backend/src/controllers/mobileController.js
// Mobile document upload pipeline.
//
// Flow:
//   1. Consume single-use QR token from Redis → derive session_id (SHA-256 hash)
//   2. Upload raw image to Supabase Storage
//   3. Execute parallel AI swarm (Vision OCR, Watchdog AML, Advisor) via Orchestrate
//   4. Gate on clarity score — RETAKE_IMAGE if < 0.80, unless retry limit reached
//   5. Name-match gate — hard reject < 50%, soft flag 50–79%
//   6. Insert teller ticket (with session_id) into PostgreSQL
//   7. Return ticket_id, status, cross_sell_offer to mobile PWA
//
// Retry tracking: attempt count is stored in Redis as `upload:attempts:{accountId}`
// with a 10-minute TTL, matching the QR token window.

import crypto from 'crypto';
import { consumeQRToken } from '../cache/sessionManager.js';
import { set as redisSet, get as redisGet, incrWithExpiry } from '../cache/redisClient.js';
import { uploadDocument } from '../services/storageService.js';
import { executeParallelSwarm } from '../ai/swarmOrchestrator.js';
import { computeNameMatchScore } from '../ai/visionAgent.js';
import { query } from '../db/index.js';
import { emitAuthEvent, AuditEventType } from '../ai/governanceSidecar.js';

/**
 * Derive a stable, non-reversible session identifier from the QR token.
 * Stored in teller_tickets and audit_logs so every row can be traced back
 * to the exact kiosk session that triggered it.
 * @param {string} qrToken
 * @returns {string} 32-char hex string
 */
function deriveSessionId(qrToken) {
  return crypto.createHash('sha256').update(qrToken).digest('hex').slice(0, 32);
}

const MAX_RETRIES = 3;
const RETRY_TTL = 600; // 10 minutes — matches QR token TTL

function uploadAttemptsKey(accountId) {
  return `upload:attempts:${accountId}`;
}

/**
 * POST /api/mobile/upload
 * Multipart document upload for PAN card via mobile PWA.
 * File is parsed by multer middleware before this handler runs (req.file is populated).
 */
export async function uploadMobileDocument(req, res) {
  const { qr_token } = req.body;
  const file = req.file;

  if (!qr_token) {
    return res.status(400).json({ error: 'ERR_MISSING_QR_TOKEN' });
  }

  // Consume the single-use QR token — returns accountId or null.
  // Derive session_id BEFORE consuming so we have it even if consumption fails.
  const sessionId = deriveSessionId(qr_token);
  const accountId = await consumeQRToken(qr_token);
  if (!accountId) {
    return res.status(401).json({ error: 'ERR_INVALID_OR_EXPIRED_QR_TOKEN' });
  }

  if (!file) {
    return res.status(400).json({ error: 'ERR_NO_FILE_UPLOADED' });
  }

  try {
    // Check current attempt count (before incrementing — we increment only on OCR failure)
    const currentAttemptStr = await redisGet(uploadAttemptsKey(accountId));
    const currentAttempt = parseInt(currentAttemptStr || '0', 10);

    // 1. Upload raw image to Supabase Storage (always — even before OCR)
    const documentPath = await uploadDocument(
      `pan_${accountId}_${Date.now()}.${file.mimetype.split('/')[1] || 'jpg'}`,
      file.buffer,
      file.mimetype
    );

    // 2. Run parallel AI swarm: Vision OCR + Watchdog AML + Advisor
    const { ocr, watchdog, advisor } = await executeParallelSwarm(
      accountId,
      file.buffer,
      file.mimetype
    );

    // 3. Clarity gate — if clarity is below threshold AND we haven't hit max retries
    if (ocr.clarity_score < 0.80 && currentAttempt < MAX_RETRIES - 1) {
      // Increment retry counter
      await incrWithExpiry(uploadAttemptsKey(accountId), RETRY_TTL);

      return res.status(400).json({
        error: 'RETAKE_IMAGE',
        message: 'Image clarity is below the required 80% threshold. Please retake the photo.',
        confidence: ocr.clarity_score,
        attempt: currentAttempt + 1,
        max_attempts: MAX_RETRIES,
      });
    }

    // 4. Name-match gate (Spec §15 — 3-tier threshold logic)
    // Only applied when OCR produced a name (skipped for PENDING_MANUAL_REVIEW path).
    const forceManualReview = ocr.clarity_score < 0.80 && currentAttempt >= MAX_RETRIES - 1;

    if (!forceManualReview && ocr.name && ocr.name !== 'UNKNOWN') {
      // Fetch the registered account name for fuzzy comparison
      const accountRows = await query`SELECT full_name FROM accounts WHERE id = ${accountId}`;
      const registeredName = accountRows[0]?.full_name || '';

      const nameMatchScore = computeNameMatchScore(ocr.name, registeredName);

      // Hard reject: score below 50% — no ticket created, error returned to mobile
      if (nameMatchScore < 0.50) {
        return res.status(400).json({
          error: 'MISMATCH_ERROR',
          message: 'The name on the uploaded document does not match the account record. Please visit a branch teller.',
          name_match_score: nameMatchScore,
        });
      }

      // Soft flag: 50%–79% — ticket is created but marked for teller attention
      // nameMatchScore is stored on the ticket below
      ocr._nameMatchScore = nameMatchScore;
    }

    const status = forceManualReview ? 'PENDING_MANUAL_REVIEW' : 'PENDING';
    const amlFlagged = Boolean(watchdog.isSuspicious);
    const nameMatchScore = ocr._nameMatchScore ?? null;

    // Clear retry counter on success path
    await redisSet(uploadAttemptsKey(accountId), '0', { ex: 60 });

    // 5. Insert teller ticket (now includes session_id + name_mismatch_score)
    const result = await query`
      INSERT INTO teller_tickets (
        account_id,
        status,
        document_path,
        ocr_data,
        ai_confidence,
        name_mismatch_score,
        aml_flagged,
        session_id
      ) VALUES (
        ${accountId},
        ${status},
        ${documentPath},
        ${JSON.stringify({ name: ocr.name, pan_number: ocr.pan_number })},
        ${ocr.confidence ?? 0.9},
        ${nameMatchScore},
        ${amlFlagged},
        ${sessionId}
      )
      RETURNING id, status, created_at
    `;

    const ticket = result[0];

    res.status(200).json({
      ticket_id: ticket.id,
      status: ticket.status,
      cross_sell_offer: advisor,
    });

    // Fire-and-forget governance audit (PAN in ocr.pan_number will be redacted)
    emitAuthEvent(
      AuditEventType.DOCUMENT_UPLOADED,
      {
        ticket_id: ticket.id,
        pan_extracted: ocr.pan_number,
        aml_flagged: amlFlagged,
        clarity_score: ocr.clarity_score,
        name_match_score: nameMatchScore,
        forced_manual_review: forceManualReview,
      },
      accountId
    );
  } catch (err) {
    console.error('[mobileController] Document processing error:', err.message);
    res.status(500).json({ error: 'ERR_DOCUMENT_PROCESSING_FAILED', message: err.message });
  }
}

/**
 * GET /api/mobile/status/:token
 * Polling endpoint for the mobile PWA to check teller decision.
 * Uses session_id (SHA-256 of the QR token) for correct per-user lookup.
 * Safe for concurrent users — each token maps to exactly one ticket.
 */
export async function getMobileStatus(req, res) {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ error: 'ERR_MISSING_TOKEN' });
    }

    const sessionId = deriveSessionId(token);

    const rows = await query`
      SELECT id, status, rejection_reason, created_at
      FROM teller_tickets
      WHERE session_id = ${sessionId}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (!rows.length) {
      // No ticket yet — upload may still be processing
      return res.status(200).json({ status: 'PENDING' });
    }

    const ticket = rows[0];
    res.status(200).json({
      status: ticket.status,
      rejection_reason: ticket.rejection_reason || null,
    });
  } catch (err) {
    res.status(500).json({ error: 'ERR_STATUS_FETCH_FAILED' });
  }
}
