// backend/src/controllers/tellerController.js
import { query } from '../db/index.js';
import { getSignedUrl } from '../services/storageService.js';
import { emitAuthEvent, AuditEventType } from '../ai/governanceSidecar.js';

/**
 * GET /api/teller/tickets
 * Fetch pending tickets in queue.
 */
export async function getPendingTickets(req, res) {
  try {
    const rows = await query`
      SELECT 
        t.id,
        t.account_id,
        t.status,
        t.document_path,
        t.ocr_data,
        t.ai_confidence,
        t.name_mismatch_score,
        t.aml_flagged,
        t.created_at,
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

/**
 * GET /api/teller/media/:id
 * Generate 5-minute signed Supabase URL for document image.
 */
export async function getTicketMedia(req, res) {
  const { id } = req.params;

  try {
    const rows = await query`
      SELECT document_path FROM teller_tickets WHERE id = ${id} LIMIT 1
    `;

    if (!rows.length) {
      return res.status(404).json({ error: 'ERR_TICKET_NOT_FOUND' });
    }

    const signedUrl = await getSignedUrl(rows[0].document_path);
    res.status(200).json({ signed_url: signedUrl });
  } catch (err) {
    res.status(500).json({ error: 'ERR_MEDIA_FETCH_FAILED' });
  }
}

/**
 * POST /api/teller/action
 * Approve or Reject ticket.
 */
export async function handleTellerAction(req, res) {
  const { ticket_id, action, reason } = req.body;

  if (!ticket_id || !['APPROVE', 'REJECT'].includes(action)) {
    return res.status(400).json({ error: 'ERR_INVALID_ACTION_PAYLOAD' });
  }

  try {
    const tickets = await query`
      SELECT id, account_id, ocr_data, aml_flagged FROM teller_tickets WHERE id = ${ticket_id} LIMIT 1
    `;

    if (!tickets.length) {
      return res.status(404).json({ error: 'ERR_TICKET_NOT_FOUND' });
    }

    const ticket = tickets[0];

    // Enforce AML rule
    if (action === 'APPROVE' && ticket.aml_flagged) {
      return res.status(403).json({
        error: 'ERR_AML_APPROVAL_BLOCKED',
        message: 'Ticket is flagged for suspicious AML activity and cannot be approved directly by teller.',
      });
    }

    if (action === 'APPROVE') {
      const panNumber = ticket.ocr_data?.pan_number || 'ABCDE1234F';

      // Update accounts table: set pan_linked = true and store pan_number
      await query`
        UPDATE accounts
        SET pan_linked = true, pan_number = ${panNumber}
        WHERE id = ${ticket.account_id}
      `;

      // Update ticket status to APPROVED
      await query`
        UPDATE teller_tickets
        SET status = 'APPROVED'
        WHERE id = ${ticket_id}
      `;

      res.status(200).json({ status: 'APPROVED', ticket_id });

      // Fire-and-forget governance audit logging with masked PII
      emitAuthEvent(
        AuditEventType.TICKET_APPROVED || 'TICKET_APPROVED',
        { ticket_id, action: 'APPROVED', pan_linked: true },
        ticket.account_id
      );
    } else {
      // Action === REJECT
      await query`
        UPDATE teller_tickets
        SET status = 'REJECTED', rejection_reason = ${reason || 'REJECTED_BY_TELLER'}
        WHERE id = ${ticket_id}
      `;

      res.status(200).json({ status: 'REJECTED', ticket_id });

      // Fire-and-forget governance audit
      emitAuthEvent(
        AuditEventType.TICKET_REJECTED || 'TICKET_REJECTED',
        { ticket_id, action: 'REJECTED', reason },
        ticket.account_id
      );
    }
  } catch (err) {
    console.error('[tellerController] Teller action error:', err);
    res.status(500).json({ error: 'ERR_TELLER_ACTION_FAILED', message: err.message });
  }
}
