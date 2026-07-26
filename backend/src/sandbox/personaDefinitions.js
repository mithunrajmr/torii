// backend/src/sandbox/personaDefinitions.js
// Deterministic persona schemas for sandbox seeding.
// Each persona produces exact account numbers, KYC states, and transaction histories
// that map 1-to-1 with the mock database seed data in db/index.js.

const hoursAgo = (h) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();

/**
 * @typedef {Object} PersonaTransaction
 * @property {number} amount
 * @property {string|null} error_code
 * @property {string} created_at  — ISO timestamp
 */

/**
 * @typedef {Object} Persona
 * @property {string} id            — SCREAMING_SNAKE_CASE key used as route param
 * @property {string} label         — Human-readable name for UI buttons
 * @property {string} description   — One-line description shown in sandbox UI
 * @property {Object} account       — Account row fields to UPSERT
 * @property {PersonaTransaction[]} transactions — Transaction rows to INSERT
 */

/** @type {Persona[]} */
export const PERSONAS = [
  // ── 1. PAN_BLOCKED ──────────────────────────────────────────────────────────
  // Canonical demo scenario: one recent failed transaction triggers kiosk triage.
  {
    id: 'PAN_BLOCKED',
    label: 'PAN Blocked Depositor',
    description: 'Account with a recent ₹50K+ failed transaction due to missing PAN link.',
    account: {
      account_number: '1000000001',
      full_name: 'ARJUN SHARMA',
      email: 'arjun.sharma@testbank.in',
      balance: 150000.00,
      pan_linked: false,
      pan_number: null,
    },
    transactions: [
      {
        amount: 75000.00,
        error_code: 'ERR_PAN_MISSING_OVER_50K',
        created_at: hoursAgo(1.5),
      },
    ],
  },

  // ── 2. AML_SMURFER ──────────────────────────────────────────────────────────
  // 4 cash deposits just below ₹50k over 72h — classic structuring pattern.
  {
    id: 'AML_SMURFER',
    label: 'AML Smurfer',
    description: '4 sub-₹50K deposits over 72h triggers Watchdog AML structuring flag.',
    account: {
      account_number: '1000000002',
      full_name: 'RAVI MEHTA',
      email: 'ravi.mehta@testbank.in',
      balance: 196000.00,
      pan_linked: false,
      pan_number: null,
    },
    transactions: [
      { amount: 49000.00, error_code: null, created_at: hoursAgo(6)  },
      { amount: 48500.00, error_code: null, created_at: hoursAgo(18) },
      { amount: 49500.00, error_code: null, created_at: hoursAgo(36) },
      { amount: 49000.00, error_code: null, created_at: hoursAgo(60) },
    ],
  },

  // ── 3. DORMANT_ACC ──────────────────────────────────────────────────────────
  // No transactions in 12 months — tests dormant account handling.
  {
    id: 'DORMANT_ACC',
    label: 'Dormant Account',
    description: 'No transactions in 12+ months. Tests dormant-account triage paths.',
    account: {
      account_number: '1000000003',
      full_name: 'SUNITA RAO',
      email: 'sunita.rao@testbank.in',
      balance: 5000.00,
      pan_linked: false,
      pan_number: null,
    },
    transactions: [],
  },

  // ── 4. SIGN_MISMATCH ────────────────────────────────────────────────────────
  // PAN upload triggers low name-match score — tests OCR mismatch routing.
  {
    id: 'SIGN_MISMATCH',
    label: 'Signature Mismatch',
    description: 'Name on PAN will not match account name — forces teller manual review.',
    account: {
      account_number: '1000000004',
      full_name: 'PRIYA NAIR',
      email: 'priya.nair@testbank.in',
      balance: 34200.00,
      pan_linked: false,
      pan_number: null,
    },
    transactions: [
      {
        amount: 55000.00,
        error_code: 'ERR_PAN_MISSING_OVER_50K',
        created_at: hoursAgo(4),
      },
    ],
  },

  // ── 5. CLEAN_HNW ────────────────────────────────────────────────────────────
  // High Net Worth customer — PAN linked, high balance triggers FD cross-sell.
  {
    id: 'CLEAN_HNW',
    label: 'Clean HNW Customer',
    description: 'PAN already linked, ₹8.75L balance. Advisor Agent shows FD offer.',
    account: {
      account_number: '1000000005',
      full_name: 'KARAN MALHOTRA',
      email: 'karan.malhotra@testbank.in',
      balance: 875000.00,
      pan_linked: true,
      pan_number: 'KRNML5678K',
    },
    transactions: [
      {
        amount: 250000.00,
        error_code: null,
        created_at: hoursAgo(2),
      },
    ],
  },

  // ── 6. BLANK_SLATE ──────────────────────────────────────────────────────────
  // Fresh account with zero history — tests empty-state UI and zero-tx handling.
  {
    id: 'BLANK_SLATE',
    label: 'Blank Slate',
    description: 'Brand-new account. No transactions, no PAN. Tests zero-state UI.',
    account: {
      account_number: '1000000006',
      full_name: 'DEV TESTER',
      email: 'dev.tester@testbank.in',
      balance: 0.00,
      pan_linked: false,
      pan_number: null,
    },
    transactions: [],
  },
];

/**
 * Returns a persona definition by ID, or null if not found.
 * @param {string} id
 * @returns {Persona|null}
 */
export function getPersonaById(id) {
  return PERSONAS.find((p) => p.id === id) ?? null;
}

export default PERSONAS;
