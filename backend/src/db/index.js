// backend/src/db/index.js
// Supabase PostgreSQL connection pool with local dev mock fallback.

import postgres from 'postgres';

let sql = null;

// =============================================================================
// DEV SEED DATA — 6 test accounts covering every app scenario
// OTP for all accounts in dev mode is printed to the console on /otp/request.
// Teller login is handled separately via a signed JWT (see DEV NOTES below).
// =============================================================================
//
// ┌──────────────────┬──────────────────┬─────────────────────────────────────┐
// │ Account Number   │ Name             │ Scenario                            │
// ├──────────────────┼──────────────────┼─────────────────────────────────────┤
// │ 1000000001       │ Arjun Sharma     │ PAN blocked — recent failed tx      │
// │ 1000000002       │ Priya Nair       │ Clean account — no blocks           │
// │ 1000000003       │ Ravi Mehta       │ AML risk — structuring pattern      │
// │ 1000000004       │ Sunita Rao       │ Multiple recent PAN failures        │
// │ 1000000005       │ Dev Tester       │ PAN already linked — clean          │
// │ 1000000006       │ Karan Malhotra   │ High balance — FD cross-sell target │
// └──────────────────┴──────────────────┴─────────────────────────────────────┘
//
// DEV NOTES:
//   • In dev mode (no NOTIFICATION_GATEWAY_URL set) the OTP is logged to the
//     Node.js console. Watch your server terminal for: [authController][DEV] OTP for ...
//   • To get a TELLER JWT for the dashboard, hit:
//       POST /api/dev/teller-token   (only mounted in NODE_ENV !== 'production')
// =============================================================================

const now = new Date();
const hoursAgo = (h) => new Date(now.getTime() - h * 60 * 60 * 1000);

const mockDatabase = {
  accounts: [
    // ── Account 1: PAN blocked, recent failed transaction ─────────────────────
    {
      id: 'acc-0001-0000-0000-000000000001',
      user_id: 'usr-0001-0000-0000-000000000001',
      account_number: '1000000001',
      email: 'arjun.sharma@testbank.in',
      balance: 82500.00,
      pan_linked: false,
      pan_number: null,
    },
    // ── Account 2: Clean account — no compliance blocks ───────────────────────
    {
      id: 'acc-0002-0000-0000-000000000002',
      user_id: 'usr-0002-0000-0000-000000000002',
      account_number: '1000000002',
      email: 'priya.nair@testbank.in',
      balance: 34200.00,
      pan_linked: true,
      pan_number: 'BCDFE5678G',
    },
    // ── Account 3: AML risk — rapid transactions triggering watchdog ──────────
    {
      id: 'acc-0003-0000-0000-000000000003',
      user_id: 'usr-0003-0000-0000-000000000003',
      account_number: '1000000003',
      email: 'ravi.mehta@testbank.in',
      balance: 215000.00,
      pan_linked: false,
      pan_number: null,
    },
    // ── Account 4: Multiple PAN failures — 3 blocked txs in last 24h ─────────
    {
      id: 'acc-0004-0000-0000-000000000004',
      user_id: 'usr-0004-0000-0000-000000000004',
      account_number: '1000000004',
      email: 'sunita.rao@testbank.in',
      balance: 67800.00,
      pan_linked: false,
      pan_number: null,
    },
    // ── Account 5: PAN already linked — system shows general welcome ──────────
    {
      id: 'acc-0005-0000-0000-000000000005',
      user_id: 'usr-0005-0000-0000-000000000005',
      account_number: '1000000005',
      email: 'dev.tester@testbank.in',
      balance: 12000.00,
      pan_linked: true,
      pan_number: 'DEVTE1234T',
    },
    // ── Account 6: High balance — premium FD cross-sell target ────────────────
    {
      id: 'acc-0006-0000-0000-000000000006',
      user_id: 'usr-0006-0000-0000-000000000006',
      account_number: '1000000006',
      email: 'karan.malhotra@testbank.in',
      balance: 875000.00,
      pan_linked: false,
      pan_number: null,
    },
  ],

  transactions: [
    // ── Account 1 (Arjun): 1 recent PAN block — triggers proactive triage ─────
    {
      id: 'txn-0001-0000-0000-000000000001',
      account_id: 'acc-0001-0000-0000-000000000001',
      amount: 75000.00,
      error_code: 'ERR_PAN_MISSING_OVER_50K',
      created_at: hoursAgo(3),   // 3 hours ago — well within 24h window
    },

    // ── Account 3 (Ravi): 4 transactions in 48h — AML structuring pattern ─────
    {
      id: 'txn-0003-0000-0000-000000000001',
      account_id: 'acc-0003-0000-0000-000000000003',
      amount: 49000.00,           // just below ₹50k threshold — structuring signal
      error_code: null,
      created_at: hoursAgo(6),
    },
    {
      id: 'txn-0003-0000-0000-000000000002',
      account_id: 'acc-0003-0000-0000-000000000003',
      amount: 48500.00,           // second split — another structuring signal
      error_code: null,
      created_at: hoursAgo(12),
    },
    {
      id: 'txn-0003-0000-0000-000000000003',
      account_id: 'acc-0003-0000-0000-000000000003',
      amount: 55000.00,
      error_code: 'ERR_PAN_MISSING_OVER_50K',
      created_at: hoursAgo(2),   // most recent — triggers kiosk triage
    },
    {
      id: 'txn-0003-0000-0000-000000000004',
      account_id: 'acc-0003-0000-0000-000000000003',
      amount: 47000.00,
      error_code: null,
      created_at: hoursAgo(36),
    },

    // ── Account 4 (Sunita): 3 PAN failures in last 24h ───────────────────────
    {
      id: 'txn-0004-0000-0000-000000000001',
      account_id: 'acc-0004-0000-0000-000000000004',
      amount: 62000.00,
      error_code: 'ERR_PAN_MISSING_OVER_50K',
      created_at: hoursAgo(1),
    },
    {
      id: 'txn-0004-0000-0000-000000000002',
      account_id: 'acc-0004-0000-0000-000000000004',
      amount: 58000.00,
      error_code: 'ERR_PAN_MISSING_OVER_50K',
      created_at: hoursAgo(5),
    },
    {
      id: 'txn-0004-0000-0000-000000000003',
      account_id: 'acc-0004-0000-0000-000000000004',
      amount: 55500.00,
      error_code: 'ERR_PAN_MISSING_OVER_50K',
      created_at: hoursAgo(10),
    },

    // ── Account 6 (Karan): 1 PAN block on large transfer ─────────────────────
    {
      id: 'txn-0006-0000-0000-000000000001',
      account_id: 'acc-0006-0000-0000-000000000006',
      amount: 250000.00,          // ₹2.5L — large transfer, PAN missing
      error_code: 'ERR_PAN_MISSING_OVER_50K',
      created_at: hoursAgo(8),
    },
  ],

  teller_tickets: [],
  audit_logs: [],
};

if (process.env.SUPABASE_DB_URL) {
  sql = postgres(process.env.SUPABASE_DB_URL, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: { rejectUnauthorized: false },
  });
} else {
  console.info('[db/index] Running with Local Dev Database Mock (No SUPABASE_DB_URL provided)');
}

/**
 * Execute tagged-template query or mock fallback.
 */
export async function query(strings, ...values) {
  if (sql) {
    return sql(strings, ...values);
  }

  // Basic mock SQL parser for local dev
  const rawSql = typeof strings === 'string' ? strings : strings.join('?');

  if (rawSql.includes('SELECT id, email FROM accounts WHERE account_number')) {
    const accNum = values[0];
    return mockDatabase.accounts.filter((a) => a.account_number === accNum);
  }
  if (rawSql.includes('SELECT id, account_number FROM accounts WHERE account_number')) {
    const accNum = values[0];
    return mockDatabase.accounts.filter((a) => a.account_number === accNum);
  }
  if (rawSql.includes('SELECT balance FROM accounts WHERE id')) {
    const accountId = values[0];
    return mockDatabase.accounts.filter((a) => a.id === accountId).map((a) => ({ balance: a.balance }));
  }
  if (rawSql.includes('FROM transactions')) {
    const accountId = values[0];
    // Watchdog agent queries ALL transactions (no error_code filter) — detect by SQL content
    if (rawSql.includes("INTERVAL '48 hours'")) {
      // AML watchdog: return all transactions for account in last 48h
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
      return mockDatabase.transactions.filter(
        (t) => t.account_id === accountId && t.created_at >= cutoff
      );
    }
    // Auth controller: only ERR_PAN_MISSING_OVER_50K within last 24h
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return mockDatabase.transactions.filter(
      (t) =>
        t.account_id === accountId &&
        t.error_code === 'ERR_PAN_MISSING_OVER_50K' &&
        t.created_at >= cutoff24h
    );
  }
  if (rawSql.includes('INSERT INTO teller_tickets')) {
    const newTicket = {
      id: `ticket_${Date.now()}`,
      account_id: values[0],
      status: values[1],
      document_path: values[2],
      ocr_data: typeof values[3] === 'string' ? JSON.parse(values[3]) : values[3],
      ai_confidence: values[4],
      aml_flagged: values[5],
      created_at: new Date(),
    };
    mockDatabase.teller_tickets.unshift(newTicket);
    return [{ id: newTicket.id, status: newTicket.status, created_at: newTicket.created_at }];
  }
  if (rawSql.includes('FROM teller_tickets')) {
    // Support both simple SELECT and the JOIN query from tellerController
    if (rawSql.includes('WHERE t.id =') || rawSql.includes("WHERE id =")) {
      const ticketId = values[0];
      return mockDatabase.teller_tickets.filter((t) => t.id === ticketId);
    }
    if (rawSql.includes('WHERE t.status IN')) {
      // Teller dashboard queue — return pending tickets with account_number joined
      return mockDatabase.teller_tickets
        .filter((t) => ['PENDING', 'PENDING_MANUAL_REVIEW'].includes(t.status))
        .map((t) => {
          const acc = mockDatabase.accounts.find((a) => a.id === t.account_id);
          return { ...t, account_number: acc?.account_number || null };
        });
    }
    // Status poller — most recent ticket
    return mockDatabase.teller_tickets.slice(0, 1);
  }
  if (rawSql.includes('UPDATE accounts')) {
    const panNumber = values[0];
    const accountId = values[1];
    const acc = mockDatabase.accounts.find((a) => a.id === accountId);
    if (acc) {
      acc.pan_linked = true;
      acc.pan_number = panNumber;
    }
    return [{ updated: true }];
  }
  if (rawSql.includes('UPDATE teller_tickets')) {
    const status = values[0];
    const id = values[1];
    const ticket = mockDatabase.teller_tickets.find((t) => t.id === id);
    if (ticket) {
      ticket.status = status;
    }
    return [{ updated: true }];
  }
  if (rawSql.includes('INSERT INTO audit_logs')) {
    mockDatabase.audit_logs.push({
      id: `audit_${Date.now()}`,
      event_type: values[0],
      payload_snapshot: values[1],
      actor_id: values[2],
      created_at: new Date(),
    });
    return [{ inserted: true }];
  }

  return [];
}

export default query;
