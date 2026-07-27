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
import { getQRToken, consumeQRToken } from '../cache/sessionManager.js';
import { set as redisSet, get as redisGet, incrWithExpiry } from '../cache/redisClient.js';
import { uploadDocument } from '../services/storageService.js';
import { executeParallelSwarm } from '../ai/swarmOrchestrator.js';
import { computeNameMatchScore, processVisionOCR } from '../ai/visionAgent.js';
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

  const sessionId = deriveSessionId(qr_token);
  // Read accountId bound to QR token (do NOT delete yet so retries on RETAKE_IMAGE work)
  const accountId = await getQRToken(qr_token);
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

    // 1. Upload raw image to Supabase Storage (fallback to memory data URL if storage fails)
    let documentPath;
    try {
      documentPath = await uploadDocument(
        `pan_${accountId}_${Date.now()}.${file.mimetype.split('/')[1] || 'jpg'}`,
        file.buffer,
        file.mimetype
      );
    } catch (uploadErr) {
      console.warn('[mobileController] Storage upload failed, using in-memory data URL fallback:', uploadErr.message);
      documentPath = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    }

    // 2. Run parallel AI swarm: Vision OCR + Watchdog AML + Advisor
    // Pass sessionId so telemetry can be linked to this session
    const { ocr, watchdog, advisor, _meta } = await executeParallelSwarm(
      accountId,
      file.buffer,
      file.mimetype,
      { sessionId }
    );

    // 3. Quality & Anti-Fraud Gate — use dynamic thresholds from agent_config
    const clarityThreshold = _meta?.clarity_threshold ?? 0.80;
    const failedQuality = ocr.clarity_score < clarityThreshold || ocr.tampering_detected || ocr.is_specimen_or_dummy;
    if (failedQuality && currentAttempt < MAX_RETRIES - 1) {
      await incrWithExpiry(uploadAttemptsKey(accountId), RETRY_TTL);

      const rejectionReason = ocr.rejection_reason || (ocr.clarity_score < 0.80 ? 'IMAGE_CLARITY_BELOW_80_PERCENT' : 'DOCUMENT_DEFACED_OR_INVALID');

      return res.status(400).json({
        error: 'RETAKE_IMAGE',
        message: `Verification rejected: ${rejectionReason}. Please retake a clear photo.`,
        confidence: ocr.clarity_score,
        tampering_detected: Boolean(ocr.tampering_detected),
        is_specimen_or_dummy: Boolean(ocr.is_specimen_or_dummy),
        rejection_reason: rejectionReason,
        attempt: currentAttempt + 1,
        max_attempts: MAX_RETRIES,
      });
    }

    // Ticket generation is proceeding — now consume the single-use QR token
    await consumeQRToken(qr_token);

    // 4. Name-match gate (Spec §15 — 3-tier threshold logic)
    const forceManualReview = failedQuality && currentAttempt >= MAX_RETRIES - 1;

    if (!forceManualReview && ocr.name && ocr.name !== 'UNKNOWN') {
      const accountRows = await query`SELECT full_name FROM accounts WHERE id = ${accountId}`;
      const registeredName = accountRows[0]?.full_name || '';

      const nameMatchScore = computeNameMatchScore(ocr.name, registeredName);

      // Use dynamic thresholds from agent_config (fallback to safe defaults)
      const hardRejectThreshold = _meta?.name_match_hard_reject ?? 0.50;
      const softFlagThreshold   = _meta?.name_match_soft_flag   ?? 0.80;

      if (nameMatchScore < hardRejectThreshold) {
        return res.status(400).json({
          error: 'MISMATCH_ERROR',
          message: 'The name on the uploaded document does not match the account record. Please visit a branch teller.',
          name_match_score: nameMatchScore,
        });
      }

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
        ${JSON.stringify({
          name: ocr.name,
          pan_number: ocr.pan_number,
          id_type: ocr.id_type,
          id_number: ocr.id_number,
          dob: ocr.dob,
        })},
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
        id_type: ocr.id_type,
        id_number: ocr.id_number,
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
 * POST /api/mobile/test-ocr
 * Dev/Demo endpoint to directly upload an image buffer and analyze it using Gemini 2.5 SDK.
 */
export async function testOcrHandler(req, res) {
  const startTime = Date.now();
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'ERR_NO_FILE_UPLOADED',
      message: 'Please upload an image file using the "document" field.',
    });
  }

  try {
    const ocrResult = await processVisionOCR(req.file.buffer, req.file.mimetype);
    const durationMs = Date.now() - startTime;

    res.status(200).json({
      success: true,
      processing_time_ms: durationMs,
      raw_ocr: ocrResult,
      db_payload: {
        name: ocrResult.name,
        pan_number: ocrResult.pan_number,
        id_type: ocrResult.id_type,
        id_number: ocrResult.id_number,
        dob: ocrResult.dob,
      },
      audit_payload: {
        pan_extracted: ocrResult.pan_number,
        id_type: ocrResult.id_type,
        id_number: ocrResult.id_number,
        clarity_score: ocrResult.clarity_score,
        confidence: ocrResult.confidence,
        heuristic_corrections_applied: Boolean(ocrResult.pan_number),
        privacy_masked: Boolean(ocrResult.id_number && ocrResult.id_number.includes('XXXX')),
        tampering_detected: Boolean(ocrResult.tampering_detected),
        rejection_reason: ocrResult.rejection_reason || null,
      },

      image_metadata: {
        original_name: req.file.originalname,
        size_bytes: req.file.size,
        size_kb: Number((req.file.size / 1024).toFixed(1)),
        mimetype: req.file.mimetype,
      },
    });
  } catch (err) {
    console.error('[mobileController] testOcrHandler error:', err.message);
    res.status(500).json({
      success: false,
      error: err.name || 'ERR_GEMINI_OCR_FAILED',
      message: err.message,
    });
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
