// tests/api/sandbox_endpoints.test.js
// Integration tests for the sandbox REST API endpoints.
// Uses supertest against the real Express app with mocked DB and Redis.
//
// We mock db/index.js and redisClient.js so these tests never touch
// live infrastructure — they work identically in CI and local dev.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock Redis ─────────────────────────────────────────────────────────────
// Simple in-process store matching the redisClient interface.
const _mockRedis = new Map();

vi.mock('../../backend/src/cache/redisClient.js', () => ({
  set: vi.fn(async (key, value) => { _mockRedis.set(key, String(value)); return 'OK'; }),
  get: vi.fn(async (key) => _mockRedis.get(key) ?? null),
  del: vi.fn(async (...keys) => {
    let n = 0;
    for (const k of keys) { if (_mockRedis.delete(k)) n++; }
    return n;
  }),
  ttl:  vi.fn(async () => -1),
  incrWithExpiry: vi.fn(async (key, ex) => {
    const v = Number(_mockRedis.get(key) ?? 0) + 1;
    _mockRedis.set(key, String(v));
    return v;
  }),
  default: {},
}));

// Mock @upstash/redis to prevent resetEngine from trying a real SCAN
// even when REDIS_URL is set in the environment.
vi.mock('@upstash/redis', () => ({
  Redis: class {
    async scan() { return [0, []]; }
    async del() { return 0; }
    async set() { return 'OK'; }
    async get() { return null; }
  },
}));

// ── Mock DB ────────────────────────────────────────────────────────────────
// Minimal in-memory tables that cover every query the sandbox controller makes.
const _db = {
  accounts: [
    { id: 'acc-001', account_number: '1000000001', full_name: 'ARJUN SHARMA',  email: 'a@t.in', balance: 82500,  pan_linked: false, pan_number: null },
    { id: 'acc-002', account_number: '1000000002', full_name: 'RAVI MEHTA',    email: 'r@t.in', balance: 34200,  pan_linked: false, pan_number: null },
    { id: 'acc-003', account_number: '1000000003', full_name: 'SUNITA RAO',    email: 's@t.in', balance: 5000,   pan_linked: false, pan_number: null },
    { id: 'acc-004', account_number: '1000000004', full_name: 'PRIYA NAIR',    email: 'p@t.in', balance: 34200,  pan_linked: false, pan_number: null },
    { id: 'acc-005', account_number: '1000000005', full_name: 'KARAN MALHOTRA',email: 'k@t.in', balance: 875000, pan_linked: true,  pan_number: 'ABC' },
    { id: 'acc-006', account_number: '1000000006', full_name: 'DEV TESTER',    email: 'd@t.in', balance: 0,      pan_linked: false, pan_number: null },
  ],
  transactions: [],
  teller_tickets: [],
  audit_logs: [],
};

vi.mock('../../backend/src/db/index.js', () => ({
  query: vi.fn(async (strings, ...values) => {
    const sql = Array.isArray(strings) ? strings.join('') : String(strings);

    // Health probe
    if (sql.includes('SELECT 1')) return [{ ping: 1 }];

    // personas list endpoint — SELECT id, account_number, full_name ...
    if (sql.includes('SELECT id, account_number, full_name') && sql.includes('FROM accounts') && !sql.includes('WHERE')) {
      return _db.accounts;
    }

    // Ledger: GROUP BY with active_tickets (must come BEFORE generic FROM accounts catch-all)
    if (sql.includes('COUNT') && sql.includes('active_tickets')) {
      return _db.accounts.map((a) => ({
        id: a.id,
        account_number: a.account_number,
        full_name: a.full_name,
        balance: a.balance,
        pan_linked: a.pan_linked,
        active_tickets: 0,
      })).sort((a, b) => a.account_number.localeCompare(b.account_number));
    }

    // Seed: SELECT id FROM accounts WHERE account_number
    if (sql.includes('SELECT id FROM accounts WHERE account_number')) {
      return _db.accounts.filter((a) => a.account_number === values[0]).map((a) => ({ id: a.id }));
    }

    // Seed: INSERT INTO accounts ... ON CONFLICT
    if (sql.includes('INSERT INTO accounts') && sql.includes('ON CONFLICT')) {
      const [id, , acctNum, fullName, email, balance, panLinked, panNumber] = values;
      const idx = _db.accounts.findIndex((a) => a.account_number === acctNum);
      if (idx >= 0) {
        _db.accounts[idx] = { ..._db.accounts[idx], full_name: fullName, email, balance: Number(balance), pan_linked: panLinked, pan_number: panNumber ?? null };
      } else {
        _db.accounts.push({ id, account_number: acctNum, full_name: fullName, email, balance: Number(balance), pan_linked: panLinked, pan_number: panNumber ?? null });
      }
      return [{ id, account_number: acctNum }];
    }

    // Seed: DELETE FROM transactions WHERE account_id
    if (sql.includes('DELETE FROM transactions WHERE account_id')) {
      _db.transactions = _db.transactions.filter((t) => t.account_id !== values[0]);
      return [];
    }

    // Seed: INSERT INTO transactions
    if (sql.includes('INSERT INTO transactions')) {
      const [id, accountId, amount, errorCode, createdAt] = values;
      _db.transactions.push({ id, account_id: accountId, amount: Number(amount), error_code: errorCode ?? null, created_at: new Date(createdAt) });
      return [{ id }];
    }

    // Reset: DELETE FROM teller_tickets (no WHERE)
    if (sql.includes('DELETE FROM teller_tickets')) { _db.teller_tickets = []; return []; }

    // Reset: DELETE FROM audit_logs
    if (sql.includes('DELETE FROM audit_logs')) { _db.audit_logs = []; return []; }

    // Reset: DELETE FROM transactions (no WHERE)
    if (sql.includes('DELETE FROM transactions')) { _db.transactions = []; return []; }

    // Reset: UPDATE accounts SET balance=, pan_linked=, pan_number= WHERE account_number
    if (sql.includes('UPDATE accounts') && sql.includes('WHERE account_number')) {
      const [balance, panLinked, panNumber, acctNum] = values;
      const acc = _db.accounts.find((a) => a.account_number === acctNum);
      if (acc) { acc.balance = Number(balance); acc.pan_linked = panLinked; acc.pan_number = panNumber ?? null; }
      return [{ updated: true }];
    }

    // Transaction injection: SELECT id FROM accounts WHERE account_number
    if (sql.includes('SELECT') && sql.includes('FROM accounts') && sql.includes('WHERE account_number')) {
      return _db.accounts.filter((a) => a.account_number === values[0]).map((a) => ({ id: a.id }));
    }

    // Ledger: DISTINCT ON latest tx per account
    if (sql.includes('DISTINCT ON')) {
      const latest = {};
      for (const tx of _db.transactions) {
        if (!latest[tx.account_id] || new Date(tx.created_at) > new Date(latest[tx.account_id].created_at)) {
          latest[tx.account_id] = tx;
        }
      }
      return Object.values(latest);
    }

    // Audit logs insert
    if (sql.includes('INSERT INTO audit_logs')) {
      _db.audit_logs.push({ id: `a_${Date.now()}`, event_type: values[0], payload_snapshot: values[1], actor_id: values[2], created_at: new Date() });
      return [{ inserted: true }];
    }

    return [];
  }),
  default: vi.fn(),
}));

// Import app AFTER mocks are registered
import request from 'supertest';
import app from '../../backend/src/index.js';

// ────────────────────────────────────────────────────────────────────────────

describe('GET /api/sandbox/personas', () => {
  it('returns 200 with a personas array', async () => {
    const res = await request(app).get('/api/sandbox/personas');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.personas)).toBe(true);
  });

  it('returns exactly 6 personas', async () => {
    const res = await request(app).get('/api/sandbox/personas');
    expect(res.body.personas).toHaveLength(6);
  });

  it('each persona has id, label, description, account_number', async () => {
    const res = await request(app).get('/api/sandbox/personas');
    for (const p of res.body.personas) {
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('label');
      expect(p).toHaveProperty('description');
      expect(p).toHaveProperty('account_number');
    }
  });

  it('includes PAN_BLOCKED persona with account 1000000001', async () => {
    const res = await request(app).get('/api/sandbox/personas');
    const panBlocked = res.body.personas.find((p) => p.id === 'PAN_BLOCKED');
    expect(panBlocked).toBeDefined();
    expect(panBlocked.account_number).toBe('1000000001');
    expect(panBlocked.pan_linked).toBe(false);
  });
});

describe('POST /api/sandbox/seed/:personaId', () => {
  it('seeds PAN_BLOCKED and returns 200 with account info', async () => {
    const res = await request(app).post('/api/sandbox/seed/PAN_BLOCKED').send();
    expect(res.status).toBe(200);
    expect(res.body.account).toBeDefined();
    expect(res.body.account.account_number).toBe('1000000001');
    expect(res.body.persona_id).toBe('PAN_BLOCKED');
  });

  it('seeds AML_SMURFER with 4 transactions', async () => {
    const res = await request(app).post('/api/sandbox/seed/AML_SMURFER').send();
    expect(res.status).toBe(200);
    expect(res.body.transaction_count).toBe(4);
  });

  it('seeds BLANK_SLATE with 0 transactions', async () => {
    const res = await request(app).post('/api/sandbox/seed/BLANK_SLATE').send();
    expect(res.status).toBe(200);
    expect(res.body.transaction_count).toBe(0);
  });

  it('returns 400 for unknown persona ID', async () => {
    const res = await request(app).post('/api/sandbox/seed/NOT_A_PERSONA').send();
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('ERR_UNKNOWN_PERSONA');
  });
});

describe('DELETE /api/sandbox/reset', () => {
  it('returns 200 with cleared counts', async () => {
    const res = await request(app).delete('/api/sandbox/reset');
    expect(res.status).toBe(200);
    expect(res.body.cleared).toBeDefined();
    expect(res.body.cleared).toHaveProperty('teller_tickets');
    expect(res.body.cleared).toHaveProperty('transactions');
    expect(res.body.cleared).toHaveProperty('accounts_reset');
  });

  it('reports 6 accounts reset', async () => {
    const res = await request(app).delete('/api/sandbox/reset');
    expect(res.body.cleared.accounts_reset).toBe(6);
  });
});

describe('POST /api/sandbox/transaction', () => {
  it('injects a transaction and returns 201', async () => {
    const res = await request(app)
      .post('/api/sandbox/transaction')
      .send({ account_number: '1000000001', amount: 75000, error_code: 'ERR_PAN_MISSING_OVER_50K', status: 'FAILED' });
    expect(res.status).toBe(201);
    expect(res.body.transaction).toBeDefined();
    expect(res.body.transaction.amount).toBe(75000);
    expect(res.body.transaction.error_code).toBe('ERR_PAN_MISSING_OVER_50K');
  });

  it('injects a transaction with custom error code ERR_KYC_EXPIRED', async () => {
    const res = await request(app)
      .post('/api/sandbox/transaction')
      .send({ account_number: '1000000001', amount: 75000, error_code: 'ERR_KYC_EXPIRED' });
    expect(res.status).toBe(201);
    expect(res.body.transaction.error_code).toBe('ERR_KYC_EXPIRED');
  });

  it('returns 400 when account_number is missing', async () => {
    const res = await request(app).post('/api/sandbox/transaction').send({ amount: 5000 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('ERR_MISSING_FIELDS');
  });

  it('returns 400 when amount is zero', async () => {
    const res = await request(app).post('/api/sandbox/transaction').send({ account_number: '1000000001', amount: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('ERR_INVALID_AMOUNT');
  });

  it('returns 404 for non-existent account number', async () => {
    const res = await request(app).post('/api/sandbox/transaction').send({ account_number: '9999999999', amount: 5000 });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('ERR_ACCOUNT_NOT_FOUND');
  });
});

describe('GET /api/sandbox/ledger', () => {
  it('returns 200 with a ledger array', async () => {
    const res = await request(app).get('/api/sandbox/ledger');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.ledger)).toBe(true);
  });

  it('each ledger row has expected fields', async () => {
    const res = await request(app).get('/api/sandbox/ledger');
    for (const row of res.body.ledger) {
      expect(row).toHaveProperty('account_number');
      expect(row).toHaveProperty('balance');
      expect(row).toHaveProperty('pan_linked');
      expect(row).toHaveProperty('active_tickets');
    }
  });
});

describe('POST /api/sandbox/chaos', () => {
  it('sets chaos delay and returns 200', async () => {
    const res = await request(app).post('/api/sandbox/chaos').send({ cbsDelayMs: 1000 });
    expect(res.status).toBe(200);
    expect(res.body.rules.cbsDelayMs).toBe(1000);
  });

  it('disables chaos when cbsDelayMs is 0', async () => {
    const res = await request(app).post('/api/sandbox/chaos').send({ cbsDelayMs: 0 });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/disabled/i);
  });

  it('returns 400 for delay > 10000', async () => {
    const res = await request(app).post('/api/sandbox/chaos').send({ cbsDelayMs: 99999 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('ERR_INVALID_CHAOS_DELAY');
  });

  it('returns 400 for invalid HTTP error code', async () => {
    const res = await request(app).post('/api/sandbox/chaos').send({ cbsDelayMs: 0, forceHttpError: 418 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('ERR_INVALID_HTTP_ERROR');
  });
});

describe('GET /api/sandbox/chaos', () => {
  it('returns 200 with current rules', async () => {
    const res = await request(app).get('/api/sandbox/chaos');
    expect(res.status).toBe(200);
    expect(res.body.rules).toBeDefined();
    expect(res.body).toHaveProperty('active');
  });
});
