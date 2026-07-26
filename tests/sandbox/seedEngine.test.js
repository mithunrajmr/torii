// tests/sandbox/seedEngine.test.js
// Unit tests for the persona seed engine.
//
// Verifies:
//   - Each persona generates the correct account_number and error codes.
//   - Seeding is idempotent (calling twice gives the same result).
//   - Unknown persona ID throws a clear error.
//   - seedAllPersonas seeds all 6 personas without error.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock the DB query helper ───────────────────────────────────────────────
// We capture every query call so we can assert on the SQL and values without
// needing a live database connection.

const insertedAccounts = [];
const insertedTransactions = [];
const deletedAccounts = [];      // DELETE FROM transactions WHERE account_id
const upsertedAccounts = [];

vi.mock('../../backend/src/db/index.js', () => {
  return {
    query: vi.fn(async (strings, ...values) => {
      const sql = Array.isArray(strings) ? strings.join('') : String(strings);

      if (sql.includes('SELECT id FROM accounts')) {
        // Return empty — no existing account
        return [];
      }
      if (sql.includes('INSERT INTO accounts')) {
        const record = { id: values[0], account_number: values[2] };
        upsertedAccounts.push(record);
        return [record];
      }
      if (sql.includes('DELETE FROM transactions')) {
        deletedAccounts.push(values[0]);
        return [];
      }
      if (sql.includes('INSERT INTO transactions')) {
        insertedTransactions.push({
          account_id: values[1],
          amount: values[2],
          error_code: values[3],
        });
        return [];
      }
      return [];
    }),
    default: vi.fn(),
  };
});

// ── Mock uuid so IDs are predictable in assertions ─────────────────────────
let uuidCounter = 0;
vi.mock('uuid', () => ({
  v4: () => `mock-uuid-${++uuidCounter}`,
}));

import { seedPersona, seedAllPersonas } from '../../backend/src/sandbox/seedEngine.js';
import { PERSONAS } from '../../backend/src/sandbox/personaDefinitions.js';

describe('seedEngine', () => {
  beforeEach(() => {
    insertedAccounts.length = 0;
    insertedTransactions.length = 0;
    deletedAccounts.length = 0;
    upsertedAccounts.length = 0;
    uuidCounter = 0;
    vi.clearAllMocks();
  });

  // ── PAN_BLOCKED persona ──────────────────────────────────────────────────
  describe('PAN_BLOCKED persona', () => {
    it('resolves with account_number 1000000001', async () => {
      const result = await seedPersona('PAN_BLOCKED');
      expect(result.account.account_number).toBe('1000000001');
    });

    it('inserts exactly 1 transaction with ERR_PAN_MISSING_OVER_50K', async () => {
      await seedPersona('PAN_BLOCKED');
      expect(insertedTransactions).toHaveLength(1);
      expect(insertedTransactions[0].error_code).toBe('ERR_PAN_MISSING_OVER_50K');
      expect(insertedTransactions[0].amount).toBe(75000);
    });

    it('reports transactionCount = 1', async () => {
      const result = await seedPersona('PAN_BLOCKED');
      expect(result.transactionCount).toBe(1);
    });

    it('sets pan_linked = false on the account', async () => {
      const result = await seedPersona('PAN_BLOCKED');
      expect(result.account.pan_linked).toBe(false);
    });
  });

  // ── AML_SMURFER persona ──────────────────────────────────────────────────
  describe('AML_SMURFER persona', () => {
    it('resolves with account_number 1000000002', async () => {
      const result = await seedPersona('AML_SMURFER');
      expect(result.account.account_number).toBe('1000000002');
    });

    it('inserts exactly 4 transactions all with null error_code', async () => {
      await seedPersona('AML_SMURFER');
      expect(insertedTransactions).toHaveLength(4);
      insertedTransactions.forEach((tx) => {
        expect(tx.error_code).toBeNull();
      });
    });

    it('all 4 transactions are below ₹50,000', async () => {
      await seedPersona('AML_SMURFER');
      insertedTransactions.forEach((tx) => {
        expect(tx.amount).toBeLessThan(50000);
      });
    });
  });

  // ── DORMANT_ACC persona ──────────────────────────────────────────────────
  describe('DORMANT_ACC persona', () => {
    it('inserts zero transactions', async () => {
      await seedPersona('DORMANT_ACC');
      expect(insertedTransactions).toHaveLength(0);
    });

    it('still deletes existing transactions (purge step runs)', async () => {
      await seedPersona('DORMANT_ACC');
      // The DELETE should have been called once with the resolved account ID
      expect(deletedAccounts).toHaveLength(1);
    });
  });

  // ── CLEAN_HNW persona ────────────────────────────────────────────────────
  describe('CLEAN_HNW persona', () => {
    it('sets pan_linked = true', async () => {
      const result = await seedPersona('CLEAN_HNW');
      expect(result.account.pan_linked).toBe(true);
    });

    it('has balance of 875000', async () => {
      const result = await seedPersona('CLEAN_HNW');
      expect(result.account.balance).toBe(875000);
    });
  });

  // ── BLANK_SLATE persona ──────────────────────────────────────────────────
  describe('BLANK_SLATE persona', () => {
    it('inserts zero transactions', async () => {
      await seedPersona('BLANK_SLATE');
      expect(insertedTransactions).toHaveLength(0);
    });

    it('has balance of 0', async () => {
      const result = await seedPersona('BLANK_SLATE');
      expect(result.account.balance).toBe(0);
    });
  });

  // ── Unknown persona ──────────────────────────────────────────────────────
  describe('error handling', () => {
    it('throws a descriptive error for unknown persona ID', async () => {
      await expect(seedPersona('DOES_NOT_EXIST')).rejects.toThrow(
        /Unknown persona.*DOES_NOT_EXIST/
      );
    });

    it('error message lists valid persona IDs', async () => {
      await expect(seedPersona('BAD_ID')).rejects.toThrow(/PAN_BLOCKED/);
    });
  });

  // ── Idempotency ──────────────────────────────────────────────────────────
  describe('idempotency', () => {
    it('can be seeded twice without throwing', async () => {
      await expect(seedPersona('PAN_BLOCKED')).resolves.toBeDefined();
      await expect(seedPersona('PAN_BLOCKED')).resolves.toBeDefined();
    });
  });

  // ── seedAllPersonas ──────────────────────────────────────────────────────
  describe('seedAllPersonas', () => {
    it('seeds all 6 personas and returns an array of 6 results', async () => {
      const results = await seedAllPersonas();
      expect(results).toHaveLength(6);
    });

    it('result array contains every persona ID', async () => {
      const results = await seedAllPersonas();
      const seededIds = results.map((r) => r.personaId);
      PERSONAS.forEach((p) => {
        expect(seededIds).toContain(p.id);
      });
    });
  });
});
