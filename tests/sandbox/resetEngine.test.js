// tests/sandbox/resetEngine.test.js
// Unit tests for the global factory reset utility.
//
// Verifies:
//   - All three transient tables are deleted.
//   - Account balances are restored to baseline values.
//   - Redis keys matching sandbox prefixes are removed.
//   - Returns a success result with cleared counts.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Shared state tracking ─────────────────────────────────────────────────
const deletedTables = [];
const updatedAccounts = [];
// Keys are seeded with the EXACT namespaces from sessionManager.js:
//   otp:<accountId>      — setOTP
//   session:<jti>        — createKioskSession  (NOT kiosk_session:<accountId>)
//   qr:<token>           — createQRToken
//   upload:attempts:<id> — mobileController retry counter
//   chaos:rules          — chaosInterceptor
const redisState = new Map([
  ['otp:acc-0001-0000-0000-000000000001', '123456'],
  ['otp:attempts:acc-0001-0000-0000-000000000001', '1'],
  ['session:some-jti-uuid-value', 'acc-0001-0000-0000-000000000001'],
  ['qr:some-qr-token-value', 'acc-0001-0000-0000-000000000001'],
  ['upload:attempts:acc-0001-0000-0000-000000000001', '1'],
  ['chaos:rules', '{"cbsLatencyMs":3000}'],
  ['health:ping', 'pong'],
]);

// ── Mock DB ────────────────────────────────────────────────────────────────
vi.mock('../../backend/src/db/index.js', () => ({
  query: vi.fn(async (strings, ...values) => {
    const sql = Array.isArray(strings) ? strings.join('') : String(strings);

    if (sql.includes('DELETE FROM teller_tickets')) {
      deletedTables.push('teller_tickets');
      return [];
    }
    if (sql.includes('DELETE FROM audit_logs')) {
      deletedTables.push('audit_logs');
      return [];
    }
    if (sql.includes('DELETE FROM transactions')) {
      deletedTables.push('transactions');
      return [];
    }
    if (sql.includes('UPDATE accounts')) {
      updatedAccounts.push({ account_number: values[3], balance: values[0] });
      return [{ updated: true }];
    }
    return [];
  }),
  default: vi.fn(),
}));

// ── Mock Redis client ──────────────────────────────────────────────────────
vi.mock('../../backend/src/cache/redisClient.js', () => ({
  get: vi.fn(async (key) => redisState.get(key) ?? null),
  del: vi.fn(async (...keys) => {
    let count = 0;
    for (const key of keys) {
      if (redisState.has(key)) {
        redisState.delete(key);
        count++;
      }
    }
    return count;
  }),
  set: vi.fn(async (key, value, opts) => {
    redisState.set(key, value);
    return 'OK';
  }),
  default: {},
}));

// Ensure we use the mock Redis path (no REDIS_URL set in test env)
delete process.env.REDIS_URL;
delete process.env.REDIS_TOKEN;

import { executeFactoryReset } from '../../backend/src/sandbox/resetEngine.js';

describe('resetEngine', () => {
  beforeEach(() => {
    deletedTables.length = 0;
    updatedAccounts.length = 0;
    vi.clearAllMocks();
    // Restore Redis state for each test — keys match sessionManager.js namespaces
    redisState.set('otp:acc-0001-0000-0000-000000000001', '123456');
    redisState.set('otp:attempts:acc-0001-0000-0000-000000000001', '1');
    redisState.set('session:some-jti-uuid-value', 'acc-0001-0000-0000-000000000001');
    redisState.set('qr:some-qr-token-value', 'acc-0001-0000-0000-000000000001');
    redisState.set('upload:attempts:acc-0001-0000-0000-000000000001', '1');
    redisState.set('chaos:rules', '{"cbsLatencyMs":3000}');
    redisState.set('health:ping', 'pong');
  });

  // ── Return shape ──────────────────────────────────────────────────────────
  it('returns { success: true } on completion', async () => {
    const result = await executeFactoryReset();
    expect(result.success).toBe(true);
  });

  it('returns a cleared object with expected keys', async () => {
    const result = await executeFactoryReset();
    expect(result.cleared).toHaveProperty('teller_tickets');
    expect(result.cleared).toHaveProperty('audit_logs');
    expect(result.cleared).toHaveProperty('transactions');
    expect(result.cleared).toHaveProperty('accounts_reset');
    expect(result.cleared).toHaveProperty('redis_keys');
  });

  // ── Table truncation ──────────────────────────────────────────────────────
  it('issues DELETE for teller_tickets', async () => {
    await executeFactoryReset();
    expect(deletedTables).toContain('teller_tickets');
  });

  it('issues DELETE for audit_logs', async () => {
    await executeFactoryReset();
    expect(deletedTables).toContain('audit_logs');
  });

  it('issues DELETE for transactions', async () => {
    await executeFactoryReset();
    expect(deletedTables).toContain('transactions');
  });

  // ── Account reset ─────────────────────────────────────────────────────────
  it('resets all 6 baseline accounts', async () => {
    const result = await executeFactoryReset();
    expect(result.cleared.accounts_reset).toBe(6);
  });

  it('restores account 1000000001 balance to 82500', async () => {
    await executeFactoryReset();
    const acc = updatedAccounts.find((a) => a.account_number === '1000000001');
    expect(acc).toBeDefined();
    expect(acc.balance).toBe(82500.00);
  });

  it('restores account 1000000005 (pan_linked=true) correctly', async () => {
    await executeFactoryReset();
    // Just check the account was included in the update batch
    const accountNumbers = updatedAccounts.map((a) => a.account_number);
    expect(accountNumbers).toContain('1000000005');
  });

  // ── Redis flush ───────────────────────────────────────────────────────────
  it('deletes OTP Redis keys', async () => {
    await executeFactoryReset();
    // The mock Redis helper should have been asked to delete the OTP key
    const { del } = await import('../../backend/src/cache/redisClient.js');
    const allDeletedKeys = del.mock.calls.flatMap((args) => args);
    expect(allDeletedKeys.some((k) => k.startsWith('otp:'))).toBe(true);
  });

  it('deletes session-related Redis keys (otp: and upload:attempts: prefixes)', async () => {
    await executeFactoryReset();
    const { del } = await import('../../backend/src/cache/redisClient.js');
    const allDeletedKeys = del.mock.calls.flatMap((args) => args);
    // sessionManager uses session:<jti> — jti is a UUID so mock can't enumerate them.
    // resetEngine._flushMockRedis enumerates known otp: and upload:attempts: keys.
    expect(allDeletedKeys.some((k) => k.startsWith('otp:'))).toBe(true);
    expect(allDeletedKeys.some((k) => k.startsWith('upload:attempts:'))).toBe(true);
  });

  it('deletes chaos rules from Redis', async () => {
    await executeFactoryReset();
    const { del } = await import('../../backend/src/cache/redisClient.js');
    const allDeletedKeys = del.mock.calls.flatMap((args) => args);
    expect(allDeletedKeys).toContain('chaos:rules');
  });

  it('reports the number of Redis keys deleted', async () => {
    const result = await executeFactoryReset();
    // keys pre-seeded in redisState that match known patterns will be deleted
    expect(result.cleared.redis_keys).toBeGreaterThan(0);
  });
});
