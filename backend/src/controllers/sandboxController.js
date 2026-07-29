// backend/src/controllers/sandboxController.js
// Request handlers for the Mock CBS Sandbox control plane.
//
// All endpoints are dev/test-only — sandboxRoutes.js enforces NODE_ENV guard.
// These handlers bypass AI guardrails and PII redaction intentionally:
// this is a developer tool, not a production data path.

import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/index.js';
import { set as redisSet, get as redisGet } from '../cache/redisClient.js';
import { seedPersona, seedAllPersonas } from '../sandbox/seedEngine.js';
import { executeFactoryReset } from '../sandbox/resetEngine.js';
import { PERSONAS } from '../sandbox/personaDefinitions.js';
import { processVisionOCR } from '../ai/visionAgent.js';


// ── GET /api/sandbox/personas ─────────────────────────────────────────────────
// Returns the list of available seeding personas and their metadata.
// Used by the PersonaSeeder UI component to render buttons.
export async function listPersonas(req, res) {
  try {
    const personas = PERSONAS.map(({ id, label, description, account, transactions }) => ({
      id,
      label,
      description,
      account_number: account.account_number,
      pan_linked: account.pan_linked,
      transaction_count: transactions.length,
    }));
    res.status(200).json({ personas });
  } catch (err) {
    console.error('[sandbox] listPersonas error:', err);
    res.status(500).json({ error: 'ERR_SANDBOX_LIST_FAILED', message: err.message });
  }
}

// ── POST /api/sandbox/seed/:personaId ────────────────────────────────────────
// Seeds a specific customer persona into the database.
// Purges conflicting records and inserts deterministic account + transaction data.
export async function seedPersonaHandler(req, res) {
  const { personaId } = req.params;

  // Validate — reject early with a clear list of valid IDs
  const validIds = PERSONAS.map((p) => p.id);
  if (!validIds.includes(personaId)) {
    return res.status(400).json({
      error: 'ERR_UNKNOWN_PERSONA',
      message: `Unknown persona "${personaId}". Valid: ${validIds.join(', ')}`,
    });
  }

  try {
    const result = await seedPersona(personaId);
    res.status(200).json({
      message: 'Persona seeded successfully',
      persona_id: personaId,
      account: result.account,
      transaction_count: result.transactionCount,
    });
  } catch (err) {
    console.error(`[sandbox] seedPersona(${personaId}) error:`, err);
    res.status(500).json({ error: 'ERR_SEED_FAILED', message: err.message });
  }
}

// ── DELETE /api/sandbox/reset ─────────────────────────────────────────────────
// Global factory reset: truncates transactions, teller_tickets, audit_logs,
// restores account baselines, and flushes Redis session keys.
export async function resetSandbox(req, res) {
  try {
    const result = await executeFactoryReset();
    res.status(200).json({
      message: 'Factory reset complete',
      cleared: result.cleared,
    });
  } catch (err) {
    console.error('[sandbox] resetSandbox error:', err);
    res.status(500).json({ error: 'ERR_RESET_FAILED', message: err.message });
  }
}

// ── POST /api/sandbox/transaction ─────────────────────────────────────────────
// Injects a synthetic transaction record for a given account.
// Makes the transaction immediately visible to the kiosk triage engine.
//
// Body: { account_number, amount, error_code, status }
export async function injectTransaction(req, res) {
  const { account_number, amount, error_code = null, status = 'FAILED' } = req.body;

  if (!account_number || amount === undefined || amount === null) {
    return res.status(400).json({
      error: 'ERR_MISSING_FIELDS',
      message: 'account_number and amount are required',
    });
  }

  const parsedAmount = Number(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({
      error: 'ERR_INVALID_AMOUNT',
      message: 'amount must be a positive number',
    });
  }

  try {
    // Resolve account_id from account_number
    const accounts = await query`
      SELECT id FROM accounts WHERE account_number = ${account_number} LIMIT 1
    `;

    if (!accounts.length) {
      return res.status(404).json({
        error: 'ERR_ACCOUNT_NOT_FOUND',
        message: `No account found for account_number ${account_number}`,
      });
    }

    const accountId = accounts[0].id;
    const txId = uuidv4();
    const createdAt = new Date().toISOString();

    await query`
      INSERT INTO transactions (id, account_id, amount, error_code, created_at)
      VALUES (${txId}, ${accountId}, ${parsedAmount}, ${error_code}, ${createdAt})
    `;

    if (error_code === 'ERR_PAN_MISSING_OVER_50K') {
      await query`
        UPDATE accounts
        SET pan_linked = false
        WHERE id = ${accountId}
      `;
    }

    res.status(201).json({
      message: 'Transaction injected',
      transaction: {
        id: txId,
        account_number,
        amount: parsedAmount,
        error_code,
        status,
        created_at: createdAt,
      },
    });
  } catch (err) {
    console.error('[sandbox] injectTransaction error:', err);
    res.status(500).json({ error: 'ERR_INJECT_FAILED', message: err.message });
  }
}

// ── POST /api/sandbox/seed-tickets ───────────────────────────────────────────
// Creates realistic demo teller tickets for PAN_BLOCKED, AML_SMURFER, and SIGN_MISMATCH
// accounts. Purges existing PENDING/PENDING_MANUAL_REVIEW tickets first so re-seeding
// always gives a clean set. Only operates on accounts that actually exist.
export async function seedTickets(req, res) {
  try {
    // Ticket templates — covering various HITL review edge cases
    const TICKET_TEMPLATES = [
      {
        account_number: '1000000001',
        status: 'PENDING',
        document_path: 'pan-documents/demo/pan_arjun_sharma.jpg',
        ocr_data: { name: 'ARJUN SHARMA', pan_number: 'ARJNS1234A' },
        ai_confidence: 0.93,
        name_mismatch_score: 0.91,
        aml_flagged: false,
      },
      {
        account_number: '1000000002',
        status: 'PENDING_MANUAL_REVIEW',
        document_path: 'pan-documents/demo/pan_ravi_mehta.jpg',
        ocr_data: { name: 'RAVI MEHTA', pan_number: 'RVMHT9876B' },
        ai_confidence: 0.88,
        name_mismatch_score: 0.85,
        aml_flagged: true,  // AML_SMURFER — hard-block approval
      },
      {
        account_number: '1000000004',
        status: 'PENDING_MANUAL_REVIEW',
        document_path: 'pan-documents/demo/pan_priya_nair.jpg',
        ocr_data: { name: 'PRIYA K NAIR', pan_number: 'PRYNR4567C' },
        ai_confidence: 0.71,
        name_mismatch_score: 0.52,  // Name mismatch flagged
        aml_flagged: false,
      },
      {
        account_number: '1000000003',
        status: 'PENDING',
        document_path: 'pan-documents/demo/pan_ravi_mehta_high_risk.jpg',
        ocr_data: { name: 'RAVI MEHTA', pan_number: 'RVMHT9876B' },
        ai_confidence: 0.95,
        name_mismatch_score: 0.96,
        aml_flagged: true,
      },
      {
        account_number: '1000000006',
        status: 'PENDING_MANUAL_REVIEW',
        document_path: 'pan-documents/demo/pan_karan_malhotra.jpg',
        ocr_data: { name: 'KARAN MALHOTRA', pan_number: 'KRNML1122D' },
        ai_confidence: 0.65,  // Low confidence OCR review
        name_mismatch_score: 0.80,
        aml_flagged: false,
      },
    ];

    const created = [];
    const skipped = [];

    for (const tmpl of TICKET_TEMPLATES) {
      // Look up the account — skip if it doesn't exist yet (not seeded)
      const accs = await query`
        SELECT id FROM accounts WHERE account_number = ${tmpl.account_number} LIMIT 1
      `;
      if (!accs.length) {
        skipped.push(tmpl.account_number);
        continue;
      }
      const accountId = accs[0].id;

      // Purge existing open tickets for this account so the demo is always clean
      await query`
        DELETE FROM teller_tickets
        WHERE account_id = ${accountId}
          AND status IN ('PENDING', 'PENDING_MANUAL_REVIEW')
      `;

      // Insert fresh ticket
      const rows = await query`
        INSERT INTO teller_tickets (
          account_id, status, document_path, ocr_data,
          ai_confidence, name_mismatch_score, aml_flagged
        ) VALUES (
          ${accountId},
          ${tmpl.status},
          ${tmpl.document_path},
          ${JSON.stringify(tmpl.ocr_data)},
          ${tmpl.ai_confidence},
          ${tmpl.name_mismatch_score},
          ${tmpl.aml_flagged}
        )
        RETURNING id, status, created_at
      `;
      created.push({
        ticket_id: rows[0].id,
        account_number: tmpl.account_number,
        status: rows[0].status,
        aml_flagged: tmpl.aml_flagged,
      });
    }

    res.status(200).json({
      message: `${created.length} demo ticket(s) created`,
      tickets: created,
      skipped_accounts: skipped.length
        ? `${skipped.join(', ')} — seed those personas first`
        : 'none',
    });
  } catch (err) {
    console.error('[sandbox] seedTickets error:', err);
    res.status(500).json({ error: 'ERR_SEED_TICKETS_FAILED', message: err.message });
  }
}

// ── GET /api/sandbox/ledger ───────────────────────────────────────────────────
// Returns a real-time snapshot of all mock accounts with their current balances,
// KYC flags, and open ticket counts. Polled every 5s by LedgerInspector.jsx.
export async function getLedger(req, res) {
  try {
    // Accounts with live ticket counts
    const accounts = await query`
      SELECT
        a.id,
        a.account_number,
        a.full_name,
        a.balance,
        a.pan_linked,
        COUNT(t.id)::int AS active_tickets
      FROM accounts a
      LEFT JOIN teller_tickets t
        ON t.account_id = a.id
        AND t.status IN ('PENDING', 'PENDING_MANUAL_REVIEW')
      GROUP BY a.id, a.account_number, a.full_name, a.balance, a.pan_linked
      ORDER BY a.account_number ASC
    `;

    // Most recent transaction per account (for error_code display in ledger)
    const recentTxRows = await query`
      SELECT DISTINCT ON (account_id)
        account_id,
        amount,
        error_code,
        created_at
      FROM transactions
      ORDER BY account_id, created_at DESC
    `;

    // Build a lookup map: account_id → latest tx
    const txByAccount = {};
    for (const tx of recentTxRows) {
      txByAccount[tx.account_id] = tx;
    }

    const ledger = accounts.map((acc) => {
      const latestTx = txByAccount[acc.id] ?? null;
      return {
        id: acc.id,
        account_number: acc.account_number,
        full_name: acc.full_name,
        balance: acc.balance,
        pan_linked: acc.pan_linked,
        active_tickets: acc.active_tickets,
        latest_error_code: latestTx?.error_code ?? null,
        latest_tx_amount: latestTx?.amount ?? null,
        latest_tx_at: latestTx?.created_at ?? null,
      };
    });

    res.status(200).json({ ledger, count: ledger.length, snapshot_at: new Date() });
  } catch (err) {
    console.error('[sandbox] getLedger error:', err);
    res.status(500).json({ error: 'ERR_LEDGER_FAILED', message: err.message });
  }
}

// ── POST /api/sandbox/chaos ───────────────────────────────────────────────────
// Stores chaos rules in Redis key `chaos:rules`.
// Consumed by chaosInterceptor.js middleware on every /api/auth/* and /api/kiosk/* call.
//
// Body: { cbsDelayMs: number (0–10000), forceHttpError: number|null }
export async function setChaosRules(req, res) {
  const { cbsDelayMs = 0, forceHttpError = null } = req.body;

  const parsedDelay = Number(cbsDelayMs);
  if (isNaN(parsedDelay) || parsedDelay < 0 || parsedDelay > 10000) {
    return res.status(400).json({
      error: 'ERR_INVALID_CHAOS_DELAY',
      message: 'cbsDelayMs must be a number between 0 and 10000',
    });
  }

  if (forceHttpError !== null && ![500, 503, 429, 408].includes(Number(forceHttpError))) {
    return res.status(400).json({
      error: 'ERR_INVALID_HTTP_ERROR',
      message: 'forceHttpError must be one of: 500, 503, 429, 408, or null to disable',
    });
  }

  try {
    const rules = {
      cbsDelayMs: parsedDelay,
      forceHttpError: forceHttpError ? Number(forceHttpError) : null,
      set_at: new Date().toISOString(),
    };

    // Persist to Redis with no TTL — rules stay active until explicitly cleared.
    // Chaos is off when the key is absent or cbsDelayMs === 0.
    await redisSet('chaos:rules', JSON.stringify(rules));

    res.status(200).json({
      message: parsedDelay === 0 && !forceHttpError ? 'Chaos disabled' : 'Chaos rules active',
      rules,
    });
  } catch (err) {
    console.error('[sandbox] setChaosRules error:', err);
    res.status(500).json({ error: 'ERR_CHAOS_SET_FAILED', message: err.message });
  }
}

// ── GET /api/sandbox/chaos ────────────────────────────────────────────────────
// Returns the current chaos rules stored in Redis.
export async function getChaosRules(req, res) {
  try {
    const raw = await redisGet('chaos:rules');
    const rules = raw ? JSON.parse(raw) : { cbsDelayMs: 0, forceHttpError: null };
    res.status(200).json({ rules, active: (rules.cbsDelayMs > 0 || !!rules.forceHttpError) });
  } catch (err) {
    console.error('[sandbox] getChaosRules error:', err);
    res.status(500).json({ error: 'ERR_CHAOS_GET_FAILED', message: err.message });
  }
}

// ── POST /api/sandbox/test-ocr ───────────────────────────────────────────────
// Dev/Demo endpoint to directly upload an image buffer and analyze it using Gemini 2.5 SDK.
// Returns both raw Gemini extraction, database payload, and governance audit payload.
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
    console.error('[sandboxController] testOcrHandler error:', err.message);
    res.status(500).json({
      success: false,
      error: err.name || 'ERR_GEMINI_OCR_FAILED',
      message: err.message,
    });
  }
}

