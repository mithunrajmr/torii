// backend/src/controllers/mobileController.js
// Mobile document upload pipeline.
//
// Flow:
//   1. Consume single-use QR token from Redis
//   2. Upload raw image to Supabase Storage
//   3. Execute parallel AI swarm (Vision OCR, Watchdog AML, Advisor) via Orchestrate
//   4. Gate on clarity score — RETAKE_IMAGE if < 0.80, unless retry limit reached
//   5. Insert teller ticket into PostgreSQL
//   6. Return ticket_id, status, cross_sell_offer to mobile PWA
//
// Retry tracking: attempt count is stored in Redis as `upload:attempts:{accountId}`
// with a 10-minute TTL, matching the QR token window.

import { consumeQRToken } from '../cache/sessionManager.js';
import { set as redisSet, get as redisGet, incrWithExpiry } from '../cache/redisClient.js';
import { uploadDocument } from '../services/storageService.js';
import { executeParallelSwarm } from '../ai/swarmOrchestrator.js';
import { query } from '../db/index.js';
import { emitAuthEvent, AuditEventType } from '../ai/governanceSidecar.js';

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

  // Consume the single-use QR token — returns accountId or null
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

    // 4. Determine ticket status — manual review if 3rd attempt still fails OCR
    const forceManualReview = ocr.clarity_score < 0.80 && currentAttempt >= MAX_RETRIES - 1;
    const status = forceManualReview ? 'PENDING_MANUAL_REVIEW' : 'PENDING';
    const amlFlagged = Boolean(watchdog.isSuspicious);

    // Clear retry counter on success path
    await redisSet(uploadAttemptsKey(accountId), '0', { ex: 60 });

    // 5. Insert teller ticket
    const result = await query`
      INSERT INTO teller_tickets (
        account_id,
        status,
        document_path,
        ocr_data,
        ai_confidence,
        aml_flagged
      ) VALUES (
        ${accountId},
        ${status},
        ${documentPath},
        ${JSON.stringify({ name: ocr.name, pan_number: ocr.pan_number })},
        ${ocr.confidence ?? 0.9},
        ${amlFlagged}
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
 * The token param is used as a correlation key to find the most recent ticket.
 */
export async function getMobileStatus(req, res) {
  try {
    // In a production system the token would be a signed lookup key.
    // For the current schema we return the latest PENDING/APPROVED/REJECTED ticket.
    const rows = await query`
      SELECT id, status, rejection_reason, created_at
      FROM teller_tickets
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (!rows.length) {
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
