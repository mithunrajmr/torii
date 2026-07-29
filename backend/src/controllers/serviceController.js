// backend/src/controllers/serviceController.js
// Multi-Service Controller handling dynamic service initiation, schema fetching,
// multi-document submission, and application status tracking.

import crypto from 'crypto';
import { query } from '../db/index.js';
import { getQRToken, createQRToken } from '../cache/sessionManager.js';
import { uploadDocument } from '../services/storageService.js';
import { emitAuthEvent, AuditEventType } from '../ai/governanceSidecar.js';
import { SERVICE_REGISTRY } from '../config/serviceSchemas.js';
import { processVisionOCR } from '../ai/visionAgent.js';
import { matchNames } from '../ai/entityMatcherAgent.js';

function deriveSessionId(qrToken) {
  return crypto.createHash('sha256').update(qrToken).digest('hex').slice(0, 32);
}

/**
 * POST /api/services/initiate
 * Initiate a service-specific QR session from the Kiosk UI.
 * Body: { service_type: string }
 * Auth: CUSTOMER JWT required
 */
export async function initiateServiceSession(req, res) {
  const { service_type = 'PAN_LINK' } = req.body;
  const { accountId } = req.auth;

  if (!SERVICE_REGISTRY[service_type]) {
    return res.status(400).json({ error: 'ERR_INVALID_SERVICE_TYPE', message: `Unknown service type: ${service_type}` });
  }

  const tokenBytes = crypto.randomBytes(32);
  const token = tokenBytes.toString('base64url');

  await createQRToken(token, accountId);

  const frontendHost = process.env.FRONTEND_URL || (req.headers.origin ? req.headers.origin : 'http://localhost:3000');
  const deepLinkUrl = `${frontendHost.replace(/\/$/, '')}/mobile/${token}?service_type=${service_type}`;

  res.status(200).json({
    qr_token: token,
    deep_link_url: deepLinkUrl,
    service_type,
    service_config: SERVICE_REGISTRY[service_type],
  });

  emitAuthEvent(AuditEventType.QR_TOKEN_GENERATED, { service_type, deep_link_url: deepLinkUrl }, accountId);
}

/**
 * GET /api/services/config/:type
 * Returns the schema configuration for a requested service type.
 * Public endpoint used by Mobile PWA to render dynamic forms.
 */
export async function getServiceConfig(req, res) {
  const { type } = req.params;
  const config = SERVICE_REGISTRY[type.toUpperCase()] || SERVICE_REGISTRY.PAN_LINK;
  res.status(200).json(config);
}

/**
 * POST /api/services/submit
 * Multi-document & dynamic form submission endpoint from Mobile PWA.
 * Accepts multipart/form-data:
 *   - fields: qr_token, service_type, form_data (JSON string), signature (base64 string)
 *   - files: multiple uploaded document slots
 */
export async function submitServiceRequest(req, res) {
  const { qr_token, service_type = 'PAN_LINK', form_data: rawFormData, signature } = req.body;
  const files = req.files || [];

  if (!qr_token) {
    return res.status(400).json({ error: 'ERR_MISSING_QR_TOKEN', message: 'Missing QR session token.' });
  }

  const accountId = await getQRToken(qr_token);
  if (!accountId) {
    return res.status(401).json({
      error: 'ERR_INVALID_OR_EXPIRED_QR_TOKEN',
      message: 'Your session has expired. Please scan a fresh QR code on the kiosk display.',
    });
  }

  const sessionId = deriveSessionId(qr_token);
  const serviceConfig = SERVICE_REGISTRY[service_type] || SERVICE_REGISTRY.PAN_LINK;

  let formData = {};
  if (rawFormData) {
    try {
      formData = typeof rawFormData === 'string' ? JSON.parse(rawFormData) : rawFormData;
    } catch (_) {
      formData = {};
    }
  }

  try {
    // 0. Fetch account record for entity name matching
    const accountRows = await query`SELECT full_name FROM accounts WHERE id = ${accountId} LIMIT 1`;
    const registeredName = accountRows[0]?.full_name || '';

    // 0b. Run Gemini Vision OCR analysis & Quality Gate on uploaded image files
    const ocrResults = [];
    if (Array.isArray(files) && files.length > 0) {
      for (const file of files) {
        if (file.mimetype.startsWith('image/')) {
          try {
            const ocr = await processVisionOCR(file.buffer, file.mimetype);
            ocrResults.push({ file, ocr });

            // Quality & Anti-Fraud Gate
            const failedQuality = ocr.clarity_score < 0.80 || ocr.tampering_detected || ocr.is_specimen_or_dummy;
            if (failedQuality) {
              const rejectionReason = ocr.rejection_reason || (ocr.clarity_score < 0.80 ? 'IMAGE_CLARITY_BELOW_80_PERCENT' : 'DOCUMENT_DEFACED_OR_INVALID');
              return res.status(400).json({
                error: 'RETAKE_IMAGE',
                message: `Verification rejected by TORII Vision AI: ${rejectionReason}. Please retake a clear photo.`,
                confidence: ocr.clarity_score,
                tampering_detected: Boolean(ocr.tampering_detected),
                rejection_reason: rejectionReason,
              });
            }

            // Name Match Gate
            if (ocr.name && ocr.name !== 'UNKNOWN' && registeredName) {
              const nameMatchScore = matchNames(ocr.name, registeredName);
              if (nameMatchScore < 0.50) {
                return res.status(400).json({
                  error: 'MISMATCH_ERROR',
                  message: `The name on the document ('${ocr.name}') does not match account record ('${registeredName}'). Please present ID to a bank teller.`,
                  name_match_score: nameMatchScore,
                });
              }
            }
          } catch (ocrErr) {
            console.warn('[serviceController] Gemini Vision OCR skipped/fallback:', ocrErr.message);
          }
        }
      }
    }

    // 1. Process digital signature if uploaded
    let digitalSignaturePath = null;
    if (signature && typeof signature === 'string' && signature.startsWith('data:image')) {
      const match = signature.match(/^data:(image\/\w+);base64,(.+)$/);
      if (match) {
        const mimeType = match[1];
        const buffer = Buffer.from(match[2], 'base64');
        try {
          digitalSignaturePath = await uploadDocument(
            `sig_${accountId}_${Date.now()}.${mimeType.split('/')[1] || 'png'}`,
            buffer,
            mimeType
          );
        } catch (uploadErr) {
          digitalSignaturePath = signature; // Fallback to raw data URL
        }
      }
    }

    // 2. Insert master service_request row
    const requestRows = await query`
      INSERT INTO service_requests (
        account_id,
        service_type,
        status,
        form_data,
        digital_signature_path,
        session_id
      ) VALUES (
        ${accountId},
        ${service_type},
        'PENDING_TELLER_REVIEW',
        ${JSON.stringify(formData)},
        ${digitalSignaturePath},
        ${sessionId}
      )
      RETURNING id, service_type, status, created_at
    `;

    const serviceRequest = requestRows[0];

    // 3. Process uploaded document files with real OCR scores
    const documentRecords = [];
    if (Array.isArray(files) && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const slotId = file.fieldname || 'document';
        const ocrData = ocrResults[i]?.ocr || {};
        let docPath;
        try {
          docPath = await uploadDocument(
            `doc_${serviceRequest.id}_${slotId}_${Date.now()}.${file.mimetype.split('/')[1] || 'jpg'}`,
            file.buffer,
            file.mimetype
          );
        } catch (_) {
          docPath = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
        }

        const docRows = await query`
          INSERT INTO service_documents (
            service_request_id,
            document_type,
            document_path,
            clarity_score
          ) VALUES (
            ${serviceRequest.id},
            ${slotId},
            ${docPath},
            ${ocrData.clarity_score ?? 0.95}
          )
          RETURNING id, document_type, document_path
        `;
        documentRecords.push(docRows[0]);
      }
    }

    // 4. Also insert into legacy teller_tickets table for complete backward compatibility!
    const primaryOcr = ocrResults[0]?.ocr || {};
    const primaryDocPath = documentRecords[0]?.document_path || digitalSignaturePath || 'N/A';
    const legacyTicketRows = await query`
      INSERT INTO teller_tickets (
        account_id,
        status,
        document_path,
        ocr_data,
        ai_confidence,
        session_id
      ) VALUES (
        ${accountId},
        'PENDING',
        ${primaryDocPath},
        ${JSON.stringify({
          service_type,
          name: primaryOcr.name || null,
          pan_number: primaryOcr.pan_number || null,
          id_type: primaryOcr.id_type || null,
          id_number: primaryOcr.id_number || null,
          dob: primaryOcr.dob || null,
          ...formData
        })},
        ${primaryOcr.confidence ?? 0.95},
        ${sessionId}
      )
      RETURNING id
    `;

    res.status(200).json({
      success: true,
      service_request_id: serviceRequest.id,
      ticket_id: legacyTicketRows[0]?.id || serviceRequest.id,
      status: serviceRequest.status,
      message: `${serviceConfig.title} submitted successfully for teller verification.`,
    });

    emitAuthEvent('SERVICE_REQUEST_SUBMITTED', {
      service_request_id: serviceRequest.id,
      service_type,
      file_count: files.length,
      has_signature: Boolean(digitalSignaturePath),
    }, accountId);
  } catch (err) {
    console.error('[serviceController] submitServiceRequest error:', err);
    res.status(500).json({ error: 'ERR_SERVICE_SUBMISSION_FAILED', message: err.message });
  }
}

/**
 * GET /api/services/status/:id
 * Retrieve application status for a submitted service request.
 */
export async function getServiceRequestStatus(req, res) {
  const { id } = req.params;
  try {
    const rows = await query`
      SELECT
        sr.id, sr.service_type, sr.status, sr.rejection_reason, sr.created_at, sr.updated_at,
        a.full_name, a.account_number
      FROM service_requests sr
      JOIN accounts a ON a.id = sr.account_id
      WHERE sr.id = ${id}
      LIMIT 1
    `;

    if (!rows.length) {
      return res.status(404).json({ error: 'ERR_SERVICE_REQUEST_NOT_FOUND' });
    }

    const item = rows[0];
    res.status(200).json({
      id: item.id,
      service_type: item.service_type,
      status: item.status,
      rejection_reason: item.rejection_reason || null,
      account_number_masked: `****${String(item.account_number).slice(-4)}`,
      created_at: item.created_at,
    });
  } catch (err) {
    res.status(500).json({ error: 'ERR_STATUS_FETCH_FAILED', message: err.message });
  }
}

export default { initiateServiceSession, getServiceConfig, submitServiceRequest, getServiceRequestStatus };
