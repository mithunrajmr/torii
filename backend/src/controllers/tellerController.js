// backend/src/controllers/tellerController.js
// HITL teller queue management + APPROVE/REJECT/ESCALATE actions.
//
// Phase 3 additions:
//   - After every teller action, the agent_performance_log rows for the ticket's
//     session_id are updated with teller_outcome and teller_override.
//   - teller_override = true when a teller rejects a high-confidence AI result
//     (ai_confidence >= 0.80) or approves despite a low-confidence result (< 0.60).

import { query } from '../db/index.js';
import { getSignedUrl } from '../services/storageService.js';
import { emitAuthEvent, AuditEventType } from '../ai/governanceSidecar.js';
import { sendTicketStatusEmail } from '../services/notificationService.js';

// ── Status notification helper ────────────────────────────────────────────────
async function notifyCustomerTicketStatus(accountId, status, details = {}) {
  try {
    const rows = await query`SELECT email FROM accounts WHERE id = ${accountId} LIMIT 1`;
    const email = rows[0]?.email;
    if (!email) return;
    await sendTicketStatusEmail(email, status, details);
  } catch (err) {
    console.warn('[tellerController] Status email dispatch failed:', err.message);
  }
}

// ── Feedback loop helper ──────────────────────────────────────────────────────
/**
 * Close the HITL feedback loop by updating agent_performance_log rows that
 * belong to this ticket's session with the teller's outcome.
 *
 * teller_override logic:
 *   - APPROVE on a ticket with low Vision confidence (< 0.60) → override = true
 *   - REJECT on a ticket with high Vision confidence (>= 0.80) → override = true
 *   - Otherwise → override = false
 *
 * Always fire-and-forget — never blocks the teller action response.
 */
function writeAgentFeedback(ticket, action) {
  const sessionId = ticket.session_id;
  if (!sessionId) return; // no session link — skip

  const aiConfidence = Number(ticket.ai_confidence ?? 0);
  const tellerOutcome = action === 'APPROVE' ? 'APPROVED' :
                        action === 'REJECT'  ? 'REJECTED' : 'ESCALATED';

  const tellerOverride =
    (action === 'APPROVE' && aiConfidence < 0.60) ||
    (action === 'REJECT'  && aiConfidence >= 0.80);

  Promise.resolve()
    .then(async () => {
      // Only update rows that haven't already been closed
      await query`
        UPDATE agent_performance_log
        SET
          teller_outcome  = ${tellerOutcome},
          teller_override = ${tellerOverride},
          ticket_id       = COALESCE(ticket_id, ${ticket.id})
        WHERE session_id   = ${sessionId}
          AND teller_outcome IS NULL
      `;
    })
    .catch((err) => {
      console.warn('[tellerController] writeAgentFeedback failed:', err.message);
    });
}

// ── GET /api/teller/faq-gaps ──────────────────────────────────────────────────
export async function getFaqGaps(req, res) {
  try {
    const rows = await query`
      SELECT
        query_text,
        detected_domain,
        COUNT(*)::int          AS occurrences,
        AVG(confidence)::float AS avg_confidence,
        MAX(created_at)        AS last_seen
      FROM faq_query_log
      WHERE was_answered = false
        AND created_at >= NOW() - INTERVAL '7 days'
      GROUP BY query_text, detected_domain
      ORDER BY occurrences DESC, last_seen DESC
      LIMIT 20
    `;
    res.status(200).json({ gaps: rows, total: rows.length });
  } catch (err) {
    console.warn('[tellerController] getFaqGaps error:', err.message);
    res.status(200).json({ gaps: [], total: 0 });
  }
}

// ── GET /api/teller/tickets ───────────────────────────────────────────────────
export async function getPendingTickets(req, res) {
  try {
    const rows = await query`
      SELECT
        t.id, t.account_id, t.status, t.document_path,
        t.ocr_data, t.ai_confidence, t.name_mismatch_score,
        t.aml_flagged, t.session_id, t.created_at,
        a.account_number
      FROM teller_tickets t
      LEFT JOIN accounts a ON t.account_id = a.id
      WHERE t.status IN ('PENDING', 'PENDING_MANUAL_REVIEW')
      ORDER BY t.created_at DESC
    `;
    res.status(200).json(rows);
  } catch (err) {
    console.error('[tellerController] Error fetching tickets:', err);
    res.status(500).json({ error: 'ERR_FETCH_TICKETS_FAILED' });
  }
}

// ── GET /api/teller/media/:id ─────────────────────────────────────────────────
export async function getTicketMedia(req, res) {
  const { id } = req.params;
  try {
    const rows = await query`
      SELECT document_path FROM teller_tickets WHERE id = ${id} LIMIT 1
    `;
    if (!rows.length) return res.status(404).json({ error: 'ERR_TICKET_NOT_FOUND' });
    const signedUrl = await getSignedUrl(rows[0].document_path);
    res.status(200).json({ signed_url: signedUrl });
  } catch (err) {
    res.status(500).json({ error: 'ERR_MEDIA_FETCH_FAILED' });
  }
}

// ── POST /api/teller/action ───────────────────────────────────────────────────
export async function handleTellerAction(req, res) {
  const { ticket_id, action, reason } = req.body;
  const rawTellerId = req.auth?.accountId || null;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const tellerId = rawTellerId && UUID_RE.test(rawTellerId) ? rawTellerId : null;

  if (!ticket_id || !['APPROVE', 'REJECT', 'ESCALATE'].includes(action)) {
    return res.status(400).json({ error: 'ERR_INVALID_ACTION_PAYLOAD' });
  }

  try {
    const tickets = await query`
      SELECT id, account_id, ocr_data, aml_flagged, ai_confidence, session_id
      FROM teller_tickets WHERE id = ${ticket_id} LIMIT 1
    `;
    if (!tickets.length) return res.status(404).json({ error: 'ERR_TICKET_NOT_FOUND' });

    const ticket = tickets[0];

    // AML hard block
    if (action === 'APPROVE' && ticket.aml_flagged) {
      return res.status(403).json({
        error: 'ERR_AML_APPROVAL_BLOCKED',
        message: 'Ticket is AML-flagged and cannot be approved directly. Escalate to compliance.',
      });
    }

    if (action === 'APPROVE') {
      const panNumber = ticket.ocr_data?.pan_number || 'ABCDE1234F';

      await query`
        UPDATE accounts SET pan_linked = true, pan_number = ${panNumber}
        WHERE id = ${ticket.account_id}
      `;
      await query`
        UPDATE teller_tickets SET status = 'APPROVED', reviewed_by = ${tellerId}
        WHERE id = ${ticket_id}
      `;

      res.status(200).json({ status: 'APPROVED', ticket_id });

      // Fire-and-forget: email + audit + feedback loop
      notifyCustomerTicketStatus(ticket.account_id, 'APPROVED');
      emitAuthEvent(AuditEventType.TICKET_APPROVED, { ticket_id, action: 'APPROVED', pan_linked: true }, ticket.account_id);
      writeAgentFeedback(ticket, 'APPROVE');

    } else if (action === 'REJECT') {
      const rejectionReason = reason || 'REJECTED_BY_TELLER';

      await query`
        UPDATE teller_tickets
        SET status = 'REJECTED', rejection_reason = ${rejectionReason}, reviewed_by = ${tellerId}
        WHERE id = ${ticket_id}
      `;

      res.status(200).json({ status: 'REJECTED', ticket_id });

      notifyCustomerTicketStatus(ticket.account_id, 'REJECTED', { rejectionReason });
      emitAuthEvent(AuditEventType.TICKET_REJECTED, { ticket_id, action: 'REJECTED', reason: rejectionReason }, ticket.account_id);
      writeAgentFeedback(ticket, 'REJECT');

    } else {
      // ESCALATE
      await query`
        UPDATE teller_tickets SET status = 'ESCALATED', reviewed_by = ${tellerId}
        WHERE id = ${ticket_id}
      `;

      res.status(200).json({ status: 'ESCALATED', ticket_id });

      emitAuthEvent(AuditEventType.TICKET_ESCALATED, { ticket_id, action: 'ESCALATED', aml_flagged: ticket.aml_flagged }, ticket.account_id);
      writeAgentFeedback(ticket, 'ESCALATE');
    }
  } catch (err) {
    console.error('[tellerController] Teller action error:', err);
    res.status(500).json({ error: 'ERR_TELLER_ACTION_FAILED', message: err.message });
  }
}
