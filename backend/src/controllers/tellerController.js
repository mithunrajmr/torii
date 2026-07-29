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

async function ensureSeedTickets() {
  try {
    const countResult = await query`SELECT COUNT(*) as total FROM teller_tickets`;
    const total = parseInt(countResult[0]?.total || '0', 10);
    if (total === 0) {
      const accRows = await query`SELECT id, account_number FROM accounts LIMIT 5`;
      if (accRows.length > 0) {
        const acc1 = accRows.find((a) => a.account_number === '1000000001') || accRows[0];
        const acc2 = accRows.find((a) => a.account_number === '1000000002') || accRows[1] || acc1;
        const acc3 = accRows.find((a) => a.account_number === '1000000004') || accRows[2] || acc1;
        const acc4 = accRows.find((a) => a.account_number === '1000000008') || accRows[3] || acc1;

        await query`
          INSERT INTO teller_tickets (
            account_id, status, document_path, ocr_data, ai_confidence, name_mismatch_score, aml_flagged
          ) VALUES
            (${acc1.id}, 'PENDING', 'pan-documents/demo/pan_arjun_sharma.jpg', ${JSON.stringify({ name: 'ARJUN SHARMA', pan_number: 'ARJNS1234A', service_type: 'PAN_LINK' })}, 0.93, 0.91, false),
            (${acc2.id}, 'PENDING_MANUAL_REVIEW', 'pan-documents/demo/pan_ravi_mehta.jpg', ${JSON.stringify({ name: 'RAVI MEHTA', pan_number: 'RVMHT9876B', service_type: 'HIGH_VALUE_CLEARANCE' })}, 0.88, 0.85, true),
            (${acc3.id}, 'PENDING_MANUAL_REVIEW', 'pan-documents/demo/pan_priya_nair.jpg', ${JSON.stringify({ name: 'PRIYA K NAIR', pan_number: 'PRYNR4567C', service_type: 'ADDRESS_CHANGE' })}, 0.71, 0.52, false),
            (${acc4.id}, 'APPROVED', 'pan-documents/demo/pan_lohith_gowda.jpg', ${JSON.stringify({ name: 'LOHITH G GOWDA', pan_number: 'LHTGW5432E', service_type: 'FULL_KYC' })}, 0.98, 0.97, false),
            (${acc1.id}, 'REJECTED', 'pan-documents/demo/pan_invalid.jpg', ${JSON.stringify({ name: 'UNKNOWN', pan_number: 'INVALID123', service_type: 'NOMINEE_UPDATE' })}, 0.40, 0.10, false)
        `;
      }
    }
  } catch (err) {
    console.warn('[tellerController] Seed ticket check failed:', err.message);
  }
}

// ── GET /api/teller/tickets ───────────────────────────────────────────────────
export async function getPendingTickets(req, res) {
  const { status } = req.query;
  try {
    await ensureSeedTickets();
    const rows = status === 'all'
      ? await query`
          SELECT
            t.id, t.account_id, t.status, t.document_path,
            t.ocr_data, t.ai_confidence, t.name_mismatch_score,
            t.aml_flagged, t.session_id, t.created_at,
            a.account_number
          FROM teller_tickets t
          LEFT JOIN accounts a ON t.account_id = a.id
          ORDER BY t.created_at DESC
          LIMIT 100
        `
      : await query`
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

    const tickets = rows.map((r) => {
      let parsedOcr = r.ocr_data;
      if (typeof r.ocr_data === 'string') {
        try { parsedOcr = JSON.parse(r.ocr_data); } catch (_) { parsedOcr = {}; }
      }
      return { ...r, ocr_data: parsedOcr || {} };
    });

    res.status(200).json(tickets);
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
      const ocr = typeof ticket.ocr_data === 'string' ? (JSON.parse(ticket.ocr_data) || {}) : (ticket.ocr_data || {});
      const serviceType = ocr.service_type || 'PAN_LINK';
      const panNumber = ocr.pan_number || ocr.id_number || 'BNZPM2501F';

      // 1. Core PAN mutation
      await query`
        UPDATE accounts SET pan_linked = true, pan_number = ${panNumber}
        WHERE id = ${ticket.account_id}
      `;

      // 2. Service-specific fulfillment mutations
      if (serviceType === 'ADDRESS_CHANGE' || ocr.address_line1) {
        await query`
          UPDATE accounts SET
            address_line1 = COALESCE(${ocr.address_line1 || null}, address_line1),
            address_line2 = COALESCE(${ocr.address_line2 || null}, address_line2),
            city          = COALESCE(${ocr.city || null}, city),
            state         = COALESCE(${ocr.state || null}, state),
            pincode       = COALESCE(${ocr.pincode || null}, pincode)
          WHERE id = ${ticket.account_id}
        `.catch((e) => console.warn('[tellerController] address update warning:', e.message));
      }

      if (serviceType === 'NOMINEE_UPDATE' || ocr.nominee_name) {
        const nomineeObj = {
          name: ocr.nominee_name || null,
          relationship: ocr.relationship || null,
          dob: ocr.nominee_dob || null,
          is_minor: Boolean(ocr.is_minor),
          guardian_name: ocr.guardian_name || null,
          updated_at: new Date().toISOString(),
        };
        await query`
          UPDATE accounts SET nominee_details = ${JSON.stringify(nomineeObj)}
          WHERE id = ${ticket.account_id}
        `.catch((e) => console.warn('[tellerController] nominee update warning:', e.message));
      }

      if (serviceType === 'AADHAAR_LINK' || ocr.aadhaar_number) {
        await query`
          UPDATE accounts SET
            aadhaar_linked = true,
            aadhaar_number = COALESCE(${ocr.aadhaar_number || null}, aadhaar_number)
          WHERE id = ${ticket.account_id}
        `.catch((e) => console.warn('[tellerController] aadhaar update warning:', e.message));
      }

      if (serviceType === 'FULL_KYC') {
        await query`
          UPDATE accounts SET
            pan_linked = true,
            aadhaar_linked = true,
            kyc_status = 'VERIFIED'
          WHERE id = ${ticket.account_id}
        `.catch((e) => console.warn('[tellerController] full kyc update warning:', e.message));
      }

      // 3. Sync status to teller_tickets & service_requests tables
      await query`
        UPDATE teller_tickets SET status = 'APPROVED', reviewed_by = ${tellerId}
        WHERE id = ${ticket_id}
      `;
      if (ticket.session_id) {
        await query`
          UPDATE service_requests SET status = 'APPROVED', reviewed_by = ${tellerId}
          WHERE session_id = ${ticket.session_id}
        `.catch(() => {});
      }

      res.status(200).json({ status: 'APPROVED', ticket_id, service_type: serviceType });

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
