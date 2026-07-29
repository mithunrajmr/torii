// backend/src/sandbox/seedEngine.js
// Transactional database seeding utility for the Mock CBS Sandbox.
//
// Executes UPSERT into `accounts` and INSERT into `transactions` within a
// single logical operation. Purges any existing transactions for the account
// before re-inserting so seeds are always deterministic and idempotent.
//
// Invariants:
//   - Never bypasses governanceSidecar — this is a dev/sandbox-only module.
//   - All DB writes go through the same `query` helper used by production code.
//   - No unmasked PAN numbers are logged to console.

import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/index.js';
import { getPersonaById, PERSONAS } from './personaDefinitions.js';

/**
 * Seeds a single persona into the database.
 * 1. UPSERTs the account row (matched on account_number).
 * 2. Deletes existing transactions for that account.
 * 3. Inserts fresh transactions from the persona definition.
 *
 * @param {string} personaId  — one of the PERSONAS[].id values
 * @returns {Promise<{ account: object, transactionCount: number }>}
 * @throws  {Error} if personaId is not recognised
 */
export async function seedPersona(personaId) {
  const persona = getPersonaById(personaId);
  if (!persona) {
    throw new Error(`Unknown persona: "${personaId}". Valid IDs: ${PERSONAS.map((p) => p.id).join(', ')}`);
  }

  const { account, transactions } = persona;

  // ── Step 1: Resolve or create the account UUID ─────────────────────────────
  // Look up existing account by account_number first so we reuse the same UUID
  // (important: tickets and audit logs reference account.id by FK).
  let accountId;
  const existing = await query`
    SELECT id FROM accounts WHERE account_number = ${account.account_number}
  `;

  if (existing.length > 0) {
    accountId = existing[0].id;
  } else {
    accountId = uuidv4();
  }

  // ── Step 2: UPSERT account ─────────────────────────────────────────────────
  // First, remove any OTHER account that has the same email (from a previous seed of a
  // different persona that was never cleaned up). This prevents the unique email constraint
  // from blocking the upsert when the same email appears on a different account_number.
  await query`
    DELETE FROM accounts
    WHERE email = ${account.email}
      AND account_number != ${account.account_number}
  `;

  // Uses ON CONFLICT to update all mutable fields while preserving the UUID.
  await query`
    INSERT INTO accounts (
      id,
      user_id,
      account_number,
      full_name,
      email,
      balance,
      pan_linked,
      pan_number
    )
    VALUES (
      ${accountId},
      ${uuidv4()},
      ${account.account_number},
      ${account.full_name},
      ${account.email},
      ${account.balance},
      ${account.pan_linked},
      ${account.pan_number ?? null}
    )
    ON CONFLICT (account_number) DO UPDATE SET
      full_name  = EXCLUDED.full_name,
      email      = EXCLUDED.email,
      balance    = EXCLUDED.balance,
      pan_linked = EXCLUDED.pan_linked,
      pan_number = EXCLUDED.pan_number
  `;

  // ── Step 3: Purge stale transactions for this account ─────────────────────
  await query`
    DELETE FROM transactions WHERE account_id = ${accountId}
  `;

  // ── Step 4: Insert fresh transaction history ───────────────────────────────
  for (const tx of transactions) {
    await query`
      INSERT INTO transactions (id, account_id, amount, error_code, created_at)
      VALUES (
        ${uuidv4()},
        ${accountId},
        ${tx.amount},
        ${tx.error_code ?? null},
        ${tx.created_at}
      )
    `;
  }

  // ── Step 5: Sync matching teller tickets ──────────────────────────────────
  await query`
    DELETE FROM teller_tickets WHERE account_id = ${accountId}
  `;

  const ticketConfigs = {
    PAN_BLOCKED: {
      status: 'PENDING',
      document_path: 'pan-documents/demo/pan_arjun_sharma.jpg',
      ocr_data: { name: 'ARJUN SHARMA', pan_number: 'ARJNS1234A', service_type: 'PAN_LINK' },
      ai_confidence: 0.93,
      name_mismatch_score: 0.91,
      aml_flagged: false,
    },
    AML_SMURFER: {
      status: 'PENDING_MANUAL_REVIEW',
      document_path: 'pan-documents/demo/pan_ravi_mehta.jpg',
      ocr_data: { name: 'RAVI MEHTA', pan_number: 'RVMHT9876B', service_type: 'HIGH_VALUE_CLEARANCE' },
      ai_confidence: 0.88,
      name_mismatch_score: 0.85,
      aml_flagged: true,
    },
    SIGN_MISMATCH: {
      status: 'PENDING_MANUAL_REVIEW',
      document_path: 'pan-documents/demo/pan_priya_nair.jpg',
      ocr_data: { name: 'PRIYA K NAIR', pan_number: 'PRYNR4567C', service_type: 'ADDRESS_CHANGE' },
      ai_confidence: 0.71,
      name_mismatch_score: 0.52,
      aml_flagged: false,
    },
    CLEAN_HNW: {
      status: 'APPROVED',
      document_path: 'pan-documents/demo/pan_lohith_gowda.jpg',
      ocr_data: { name: 'LOHITH G GOWDA', pan_number: 'LHTGW5432E', service_type: 'FULL_KYC' },
      ai_confidence: 0.98,
      name_mismatch_score: 0.97,
      aml_flagged: false,
    },
  };

  if (ticketConfigs[personaId]) {
    const cfg = ticketConfigs[personaId];
    await query`
      INSERT INTO teller_tickets (
        account_id, status, document_path, ocr_data,
        ai_confidence, name_mismatch_score, aml_flagged
      ) VALUES (
        ${accountId},
        ${cfg.status},
        ${cfg.document_path},
        ${JSON.stringify(cfg.ocr_data)},
        ${cfg.ai_confidence},
        ${cfg.name_mismatch_score},
        ${cfg.aml_flagged}
      )
    `;
  }

  return {
    account: {
      id: accountId,
      account_number: account.account_number,
      full_name: account.full_name,
      balance: account.balance,
      pan_linked: account.pan_linked,
    },
    transactionCount: transactions.length,
  };
}

/**
 * Seeds ALL personas sequentially.
 * Used by the "Seed All" button on the sandbox dashboard.
 *
 * @returns {Promise<Array<{ personaId: string, account: object, transactionCount: number }>>}
 */
export async function seedAllPersonas() {
  const results = [];
  for (const persona of PERSONAS) {
    const result = await seedPersona(persona.id);
    results.push({ personaId: persona.id, ...result });
  }
  return results;
}

export default { seedPersona, seedAllPersonas };
