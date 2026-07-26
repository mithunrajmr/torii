// backend/src/ai/governanceSidecar.js
// Regulatory governance sidecar — PII redaction + immutable audit log writer.
//
// RULES:
//  - Always called fire-and-forget AFTER res.json() — never on the critical path.
//  - Primary auth response is NEVER blocked by audit log failures (Req 9.5).
//  - All PAN strings masked to XXXXX-1234-X before any DB write (Req 9.2).
//  - All full account numbers masked to last 4 digits before any DB write (Req 9.3).
//  - Retry up to 3× with exponential backoff on insert failure (Req 9.4, 9.5).

import { query } from '../db/index.js';

// PAN pattern: 5 uppercase letters + 4 digits + 1 uppercase letter  e.g. ABCDE1234F
const PAN_REGEX = /[A-Z]{5}\d{4}[A-Z]/g;
// 10-digit account number (standalone — not part of a longer number)
const ACCOUNT_NUMBER_REGEX = /\b\d{10}\b/g;

/** Valid audit event types (Req 9.1) */
export const AuditEventType = Object.freeze({
  OTP_SENT: 'OTP_SENT',
  OTP_VERIFIED: 'OTP_VERIFIED',
  OTP_FAILED: 'OTP_FAILED',
  OTP_LOCKED: 'OTP_LOCKED',
  SESSION_CREATED: 'SESSION_CREATED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  QR_TOKEN_GENERATED: 'QR_TOKEN_GENERATED',
  TX_BLOCKED_PAN_MISSING: 'TX_BLOCKED_PAN_MISSING',
  AUTH_SUCCESS: 'AUTH_SUCCESS',
  DOCUMENT_UPLOADED: 'DOCUMENT_UPLOADED',
  TICKET_APPROVED: 'TICKET_APPROVED',
  TICKET_REJECTED: 'TICKET_REJECTED',
  TICKET_ESCALATED: 'TICKET_ESCALATED',
  KIOSK_QUERY_ROUTED: 'KIOSK_QUERY_ROUTED',
  FAQ_QUERY_ANSWERED: 'FAQ_QUERY_ANSWERED',
});

// ─── PII Redaction ────────────────────────────────────────────────────────────

/**
 * Deep-clone an object and mask all PAN-like strings to "XXXXX-1234-X".
 * Traverses nested objects and arrays recursively.
 * @param {object} payload
 * @returns {object}
 */
export function redactPAN(payload) {
  return deepTransformStrings(structuredClone(payload), (str) =>
    str.replace(PAN_REGEX, 'XXXXX-1234-X')
  );
}

/**
 * Deep-clone an object and mask all 10-digit account number strings to their last 4 digits.
 * @param {object} payload
 * @returns {object}
 */
export function redactAccountNumber(payload) {
  return deepTransformStrings(structuredClone(payload), (str) =>
    str.replace(ACCOUNT_NUMBER_REGEX, (match) => `****${match.slice(-4)}`)
  );
}

/**
 * Apply both PAN and account number redactions to a payload.
 * @param {object} payload
 * @returns {object}
 */
export function redactPayload(payload) {
  return redactAccountNumber(redactPAN(structuredClone(payload)));
}

/**
 * Recursively walk an object/array and apply a string transformer to every
 * string value encountered at any depth.
 * @param {*} node
 * @param {(s: string) => string} transform
 * @returns {*}
 */
function deepTransformStrings(node, transform) {
  if (typeof node === 'string') {
    return transform(node);
  }
  if (Array.isArray(node)) {
    return node.map((item) => deepTransformStrings(item, transform));
  }
  if (node !== null && typeof node === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(node)) {
      result[k] = deepTransformStrings(v, transform);
    }
    return result;
  }
  return node;
}

// ─── Audit Log Insert (with retry) ───────────────────────────────────────────

const RETRY_DELAYS_MS = [100, 200, 400];

/**
 * Insert one immutable record into audit_logs.
 * Retries up to 3 times on failure with exponential backoff.
 * After all retries are exhausted, writes to application error log — never throws.
 * @param {{ event_type: string, payload_snapshot: object, actor_id: string|null }} record
 * @returns {Promise<void>}
 */
export async function insertAuditLog(record) {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      await query`
        INSERT INTO audit_logs (event_type, payload_snapshot, actor_id)
        VALUES (
          ${record.event_type},
          ${record.payload_snapshot},
          ${record.actor_id ?? null}
        )
      `;
      return; // success
    } catch (err) {
      if (attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
      } else {
        // All retries exhausted — log to stderr, never block the caller
        console.error('[GovernanceSidecar] audit_logs insert failed after 3 retries', {
          event_type: record.event_type,
          actor_id: record.actor_id,
          error: err.message,
        });
      }
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Emit an auth state transition event to the audit log.
 * PII is redacted before the record is committed.
 * This function is ALWAYS called fire-and-forget — callers must NOT await it.
 *
 * @param {string} eventType - one of AuditEventType values
 * @param {object} payload - raw event data; will be deep-cloned and redacted
 * @param {string|null} [actorId] - account UUID, or null for pre-auth events
 * @returns {void}  (not a Promise — fire-and-forget)
 */
export function emitAuthEvent(eventType, payload, actorId = null) {
  // Kick off async work without awaiting it — primary response is never blocked
  Promise.resolve()
    .then(() => {
      const redacted = redactPayload(payload);
      return insertAuditLog({
        event_type: eventType,
        payload_snapshot: redacted,
        actor_id: actorId,
      });
    })
    .catch((err) => {
      // Final safety net — insertAuditLog already handles retries internally
      console.error('[GovernanceSidecar] unhandled error in emitAuthEvent', err.message);
    });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default { emitAuthEvent, redactPAN, redactAccountNumber, redactPayload, insertAuditLog, AuditEventType };
