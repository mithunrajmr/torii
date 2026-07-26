// backend/src/sandbox/resetEngine.js
// Global factory reset utility for the Mock CBS Sandbox.
//
// Truncates all transient data tables and flushes ephemeral Redis keys so the
// system returns to a clean state — identical to a fresh deployment.
//
// SAFETY: This module must ONLY be reachable via sandbox routes which are
// disabled in NODE_ENV === 'production'. The sandboxRoutes.js enforces this.
//
// Invariants:
//   - The `accounts` table is NOT truncated — baseline accounts are preserved.
//     Only balances, pan_linked, and pan_number are reset to factory defaults.
//   - Redis pattern-delete uses SCAN + DEL (Upstash-compatible) rather than
//     KEYS/FLUSHDB to avoid blocking the Redis server.

import { query } from '../db/index.js';
import { del as redisDel, get as redisGet, set as redisSet } from '../cache/redisClient.js';

/**
 * Baseline account values to restore after reset.
 * Mirrors the initial mock data in db/index.js so behaviour is predictable.
 * account_number → { balance, pan_linked, pan_number }
 */
const BASELINE_ACCOUNTS = {
  '1000000001': { balance: 82500.00,  pan_linked: false, pan_number: null },
  '1000000002': { balance: 34200.00,  pan_linked: true,  pan_number: 'BCDFE5678G' },
  '1000000003': { balance: 215000.00, pan_linked: false, pan_number: null },
  '1000000004': { balance: 67800.00,  pan_linked: false, pan_number: null },
  '1000000005': { balance: 12000.00,  pan_linked: true,  pan_number: 'DEVTE1234T' },
  '1000000006': { balance: 875000.00, pan_linked: false, pan_number: null },
};

/**
 * Redis key prefixes to purge during reset.
 * These MUST match the exact key namespaces defined in sessionManager.js:
 *   otp:<accountId>            — sessionManager.keys.otp
 *   otp:attempts:<accountId>   — sessionManager.keys.otpAttempts
 *   otp:locked:<accountId>     — sessionManager.keys.otpLocked
 *   session:<jti>              — sessionManager.keys.session
 *   qr:<token>                 — sessionManager.keys.qr
 *   chaos:rules                — chaosInterceptor
 *   health:ping                — health check probe
 *   upload:attempts:<accountId>— mobileController retry counter
 */
const REDIS_KEY_PREFIXES = [
  'otp:',
  'session:',
  'qr:',
  'upload:attempts:',
  'chaos:',
  'health:',
];

/**
 * Executes a full factory reset:
 *   1. Truncates `teller_tickets`, `audit_logs`, and `transactions`.
 *   2. Resets account balances, pan_linked, and pan_number to baseline.
 *   3. Deletes all ephemeral Redis keys by prefix.
 *
 * @returns {Promise<ResetResult>}
 *
 * @typedef {Object} ResetResult
 * @property {boolean} success
 * @property {Object}  cleared   — counts of removed rows / keys
 */
export async function executeFactoryReset() {
  const cleared = {
    teller_tickets: 0,
    audit_logs: 0,
    transactions: 0,
    accounts_reset: 0,
    redis_keys: 0,
  };

  // ── 1. Truncate transient tables ───────────────────────────────────────────
  // Use DELETE rather than TRUNCATE for mock-db compatibility (mock doesn't
  // implement TRUNCATE). In production Supabase this is equivalent for our
  // table sizes; TRUNCATE would also reset sequences which we don't rely on.
  await query`DELETE FROM teller_tickets`;
  cleared.teller_tickets = 1; // row count not returned — flag as done

  await query`DELETE FROM audit_logs`;
  cleared.audit_logs = 1;

  await query`DELETE FROM transactions`;
  cleared.transactions = 1;

  // ── 2. Reset account balances to factory defaults ─────────────────────────
  for (const [accountNumber, defaults] of Object.entries(BASELINE_ACCOUNTS)) {
    await query`
      UPDATE accounts
      SET balance    = ${defaults.balance},
          pan_linked = ${defaults.pan_linked},
          pan_number = ${defaults.pan_number ?? null}
      WHERE account_number = ${accountNumber}
    `;
    cleared.accounts_reset++;
  }

  // ── 3. Flush ephemeral Redis keys by prefix ────────────────────────────────
  cleared.redis_keys = await _flushRedisByPrefixes(REDIS_KEY_PREFIXES);

  return { success: true, cleared };
}

/**
 * Deletes Redis keys matching any of the given prefixes.
 *
 * Strategy:
 *   - Real Upstash: uses SCAN + DEL pipeline in batches of 100.
 *   - Mock (in-memory Map): iterates stored keys directly.
 *
 * @param {string[]} prefixes
 * @returns {Promise<number>}  count of deleted keys
 */
async function _flushRedisByPrefixes(prefixes) {
  // Probe whether we are using real Upstash or the in-memory mock.
  // The mock exposes __mockStore via a special sentinel key; real Upstash
  // will return null. We use a softer check: if REDIS_URL is set, use SCAN.
  if (process.env.REDIS_URL && process.env.REDIS_TOKEN) {
    return _flushRealRedis(prefixes);
  }
  return _flushMockRedis(prefixes);
}

/**
 * Upstash-compatible SCAN-based bulk delete.
 * Upstash Redis REST does not support native KEYS * but does support SCAN.
 * We import the Redis instance indirectly via redisGet/redisSet to avoid
 * breaking the abstraction layer.
 */
async function _flushRealRedis(prefixes) {
  // Dynamic import of the raw Upstash client to access .scan()
  // This is the only place we reach past the redisClient wrapper.
  const { Redis } = await import('@upstash/redis');
  const client = new Redis({
    url: process.env.REDIS_URL,
    token: process.env.REDIS_TOKEN,
  });

  let deleted = 0;
  for (const prefix of prefixes) {
    let cursor = 0;
    do {
      const [nextCursor, keys] = await client.scan(cursor, {
        match: `${prefix}*`,
        count: 100,
      });
      cursor = Number(nextCursor);
      if (keys.length > 0) {
        await client.del(...keys);
        deleted += keys.length;
      }
    } while (cursor !== 0);
  }
  return deleted;
}

/**
 * In-memory mock: iterates the mockStore Map exported via a test-only sentinel.
 * We reach into the mock by setting/getting known keys; the mock Map is module-
 * scoped in redisClient.js so we enumerate them by trying prefix-keyed GETs.
 *
 * For the mock this is best-effort — we delete the specific key patterns we
 * know the application creates, rather than a full scan.
 */
async function _flushMockRedis(prefixes) {
  // Known concrete key shapes used in the codebase.
  //
  // Key namespaces come from sessionManager.js:
  //   otp:<accountId>           — setOTP / getOTP
  //   otp:attempts:<accountId>  — incrementOTPAttempts
  //   otp:locked:<accountId>    — lockOTPEntry
  //   session:<jti>             — createKioskSession  (NOT kiosk_session:<accountId>)
  //   qr:<token>                — createQRToken
  //
  // Additional keys from mobileController and chaosInterceptor:
  //   upload:attempts:<accountId> — retry counter (mobileController)
  //   chaos:rules                 — chaosInterceptor
  //   health:ping                 — health check probe
  //
  // NOTE: session keys use the JWT jti (UUID), not accountId. Since mock sessions
  // are transient (in-memory Map), they expire when the process restarts. However
  // we attempt deletion of any lingering keys using the prefix pattern via get+del.
  const MOCK_ACCOUNT_IDS = [
    'acc-0001-0000-0000-000000000001',
    'acc-0002-0000-0000-000000000002',
    'acc-0003-0000-0000-000000000003',
    'acc-0004-0000-0000-000000000004',
    'acc-0005-0000-0000-000000000005',
    'acc-0006-0000-0000-000000000006',
  ];

  const knownKeyPatterns = [
    // OTP keys — format: otp:<accountId>
    ...MOCK_ACCOUNT_IDS.map((id) => `otp:${id}`),
    // OTP attempt counters — format: otp:attempts:<accountId>
    ...MOCK_ACCOUNT_IDS.map((id) => `otp:attempts:${id}`),
    // OTP lockout keys — format: otp:locked:<accountId>
    ...MOCK_ACCOUNT_IDS.map((id) => `otp:locked:${id}`),
    // Upload retry counters — format: upload:attempts:<accountId>
    ...MOCK_ACCOUNT_IDS.map((id) => `upload:attempts:${id}`),
    // Chaos rules
    'chaos:rules',
    // Health probe
    'health:ping',
    // NOTE: session:<jti> and qr:<token> keys are UUID-based and cannot be
    // enumerated without a scan. In the in-memory mock these expire naturally
    // when the Node process restarts, or are cleared on logout via deleteKioskSession.
    // For a hard reset during testing, rely on the mock Map being module-scoped
    // (cleared on process restart) or use the Upstash SCAN path for real Redis.
  ];

  let deleted = 0;
  for (const key of knownKeyPatterns) {
    const val = await redisGet(key);
    if (val !== null) {
      await redisDel(key);
      deleted++;
    }
  }
  return deleted;
}

export default { executeFactoryReset };
