// backend/src/controllers/systemController.js
// Production system radar — proactive failure interception endpoint.
//
// GET /api/system/radar
//   Returns the most recent unresolved failed transactions in the last 24 hours,
//   joined with account metadata. Used by the landing page SectionGRadar component
//   to display live compliance roadblock alerts.
//
// This is a PUBLIC endpoint (no auth required) — it returns masked account numbers
//   and never exposes full PAN numbers, email addresses, or raw account UUIDs.
//
// Degrades gracefully on DB failure — returns empty failures array so the radar
//   shows the green idle state rather than crashing the landing page.

import { query } from '../db/index.js';

/**
 * GET /api/system/radar
 * Returns active compliance failures in the last 24 hours.
 *
 * Response shape:
 * {
 *   failures: [
 *     {
 *       account_number: "****0001",   // last-4 masked
 *       name: "ARJUN S.",             // first name + last initial only
 *       error_code: "ERR_PAN_MISSING_OVER_50K",
 *       amount: 75000,
 *       created_at: "2026-07-26T...",
 *       diagnosis: "PAN card not linked — transactions over ₹50,000 are blocked"
 *     }
 *   ],
 *   activeCount: 1,
 *   snapshot_at: "2026-07-26T..."
 * }
 */
export async function getSystemRadar(req, res) {
  try {
    const rows = await query`
      SELECT
        t.id             AS tx_id,
        t.amount,
        t.error_code,
        t.created_at,
        a.account_number,
        a.full_name,
        a.pan_linked
      FROM transactions t
      JOIN accounts a ON a.id = t.account_id
      WHERE t.error_code IS NOT NULL
        AND t.created_at >= NOW() - INTERVAL '24 hours'
        AND a.pan_linked = false
      ORDER BY t.created_at DESC
      LIMIT 20
    `;

    const failures = rows.map((row) => {
      // Mask account number to last 4 digits — never expose full number
      const accNum  = String(row.account_number || '');
      const masked  = accNum.length > 4 ? `****${accNum.slice(-4)}` : accNum;

      // Mask name to first name + last initial only
      const nameParts = (row.full_name || '').trim().split(/\s+/);
      const maskedName = nameParts.length >= 2
        ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.`
        : nameParts[0] || 'Customer';

      // Human-readable diagnosis per error code
      const diagnosisMap = {
        ERR_PAN_MISSING_OVER_50K:
          'PAN card not linked — transactions over ₹50,000 are blocked until PAN is verified',
      };
      const diagnosis = diagnosisMap[row.error_code]
        || `Compliance hold: ${row.error_code}`;

      return {
        account_number: masked,
        name:           maskedName,
        error_code:     row.error_code,
        amount:         Number(row.amount),
        created_at:     row.created_at,
        diagnosis,
      };
    });

    // Deduplicate by masked account — show only the most recent failure per account
    const seen = new Set();
    const deduped = failures.filter((f) => {
      if (seen.has(f.account_number)) return false;
      seen.add(f.account_number);
      return true;
    });

    res.status(200).json({
      failures:    deduped,
      activeCount: deduped.length,
      snapshot_at: new Date(),
    });
  } catch (err) {
    console.error('[systemController] getSystemRadar error:', err.message);
    // Graceful degradation — landing page shows idle/green state
    res.status(200).json({
      failures:    [],
      activeCount: 0,
      snapshot_at: new Date(),
      _error:      'Radar temporarily unavailable',
    });
  }
}

export default { getSystemRadar };
