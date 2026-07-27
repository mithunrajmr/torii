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
      full_name: 'ARJUN SHARMA',
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
      full_name: 'PRIYA NAIR',
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
      full_name: 'RAVI MEHTA',
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
      full_name: 'SUNITA RAO',
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
      full_name: 'DEV TESTER',
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
      full_name: 'KARAN MALHOTRA',
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

  // Health probe — SELECT 1 AS ping
  if (rawSql.includes('SELECT 1')) {
    return [{ ping: 1 }];
  }

  // ── Account CRUD (teller portal) ──────────────────────────────────────────

  // account_number_seq UPDATE (auto-generate account number)
  if (rawSql.includes('UPDATE account_number_seq')) {
    if (!mockDatabase._accSeq) mockDatabase._accSeq = 7;
    mockDatabase._accSeq += 1;
    return [{ last_seq: mockDatabase._accSeq }];
  }

  // GET /api/teller/accounts — list all (with optional search via LIKE)
  if (rawSql.includes('SELECT id, account_number, full_name, email, balance') && rawSql.includes('FROM accounts')) {
    // Ensure every mock account has a created_at date for consistent display
    const allWithDates = mockDatabase.accounts.map((a, i) => ({
      ...a,
      created_at: a.created_at || new Date(Date.now() - i * 60000),
    }));
    if (!rawSql.includes('WHERE')) {
      // No search — return all, newest first
      return [...allWithDates].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    // Search case — filter by name/account_number containing values[0] (stripped of %)
    const term = String(values[0] || '').replace(/%/g, '').toLowerCase();
    return allWithDates.filter(
      (a) =>
        (a.full_name || '').toLowerCase().includes(term) ||
        String(a.account_number).includes(term)
    );
  }

  // GET /api/teller/accounts/:id
  if (rawSql.includes('FROM accounts') && rawSql.includes('WHERE id =')) {
    const id = values[0];
    return mockDatabase.accounts.filter((a) => a.id === id);
  }

  // INSERT INTO accounts (CRUD create — account_number is passed as values[2])
  if (rawSql.includes('INSERT INTO accounts') && rawSql.includes('RETURNING')) {
    const [id, userId, accountNumber, fullName, email, balance] = values;
    if (mockDatabase.accounts.find((a) => a.email === email)) {
      throw new Error('duplicate key value violates unique constraint');
    }
    const created_at = new Date();
    const newAcc = {
      id, user_id: userId, account_number: accountNumber,
      full_name: fullName, email, balance: Number(balance),
      pan_linked: false, pan_number: null, created_at,
    };
    mockDatabase.accounts.push(newAcc);
    return [{ id, account_number: accountNumber, full_name: fullName, email, balance: Number(balance), pan_linked: false, created_at }];
  }

  // UPDATE accounts SET full_name / email / balance (CRUD update — COALESCE pattern)
  if (rawSql.includes('UPDATE accounts') && rawSql.includes('COALESCE') && rawSql.includes('RETURNING')) {
    // values: [full_name|null, email|null, balance|null, id]
    const [newName, newEmail, newBalance, id] = values;
    const acc = mockDatabase.accounts.find((a) => a.id === id);
    if (!acc) return [];
    if (newName    != null) acc.full_name = newName;
    if (newEmail   != null) acc.email     = newEmail;
    if (newBalance != null) acc.balance   = Number(newBalance);
    return [{ ...acc }];
  }

  if (rawSql.includes('SELECT id, email FROM accounts WHERE account_number')) {
    const accNum = values[0];
    return mockDatabase.accounts.filter((a) => a.account_number === accNum);
  }
  if (rawSql.includes('SELECT id, account_number FROM accounts WHERE account_number')) {
    const accNum = values[0];
    return mockDatabase.accounts.filter((a) => a.account_number === accNum);
  }
  if (rawSql.includes('SELECT email FROM accounts WHERE id')) {
    const accountId = values[0];
    return mockDatabase.accounts.filter((a) => a.id === accountId).map((a) => ({ email: a.email }));
  }
  if (rawSql.includes('SELECT full_name FROM accounts WHERE id')) {
    const accountId = values[0];
    return mockDatabase.accounts.filter((a) => a.id === accountId).map((a) => ({ full_name: a.full_name }));
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
    // Column order: account_id, status, document_path, ocr_data, ai_confidence,
    //               name_mismatch_score, aml_flagged, session_id
    const newTicket = {
      id: `ticket_${Date.now()}`,
      account_id: values[0],
      status: values[1],
      document_path: values[2],
      ocr_data: typeof values[3] === 'string' ? JSON.parse(values[3]) : values[3],
      ai_confidence: values[4],
      name_mismatch_score: values[5] ?? null,
      aml_flagged: values[6],
      session_id: values[7] ?? null,
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
    if (rawSql.includes('WHERE session_id =')) {
      // Status poller — find ticket by session_id (correct multi-user lookup)
      const sessionId = values[0];
      const filtered = mockDatabase.teller_tickets.filter((t) => t.session_id === sessionId);
      return filtered.slice(0, 1);
    }
    // Status poller fallback — most recent ticket (dev only)
    return mockDatabase.teller_tickets.slice(0, 1);
  }
  if (rawSql.includes('UPDATE accounts')) {
    // Sandbox reset: UPDATE accounts SET balance=, pan_linked=, pan_number= WHERE account_number
    if (rawSql.includes('WHERE account_number')) {
      const [balance, panLinked, panNumber, accountNumber] = values;
      const acc = mockDatabase.accounts.find((a) => a.account_number === accountNumber);
      if (acc) {
        acc.balance    = Number(balance);
        acc.pan_linked = panLinked;
        acc.pan_number = panNumber ?? null;
      }
      return [{ updated: true }];
    }
    // Teller approval: UPDATE accounts SET pan_linked = true, pan_number = $1 WHERE id = $2
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
    // Three query shapes from tellerController:
    //   APPROVE/ESCALATE: SET status=$1, reviewed_by=$2 WHERE id=$3     → values = [status, tellerId, ticketId]
    //   REJECT:           SET status=$1, rejection_reason=$2, reviewed_by=$3 WHERE id=$4 → values.length === 4
    if (values.length >= 4) {
      // Reject path — status, rejection_reason, reviewed_by, ticket_id
      const [status, rejectionReason, reviewedBy, id] = values;
      const ticket = mockDatabase.teller_tickets.find((t) => t.id === id);
      if (ticket) {
        ticket.status = status;
        ticket.rejection_reason = rejectionReason;
        ticket.reviewed_by = reviewedBy;
      }
    } else if (values.length === 3) {
      // Approve / Escalate path — status, reviewed_by, ticket_id
      const [status, reviewedBy, id] = values;
      const ticket = mockDatabase.teller_tickets.find((t) => t.id === id);
      if (ticket) {
        ticket.status = status;
        ticket.reviewed_by = reviewedBy;
      }
    } else {
      // Fallback for any 2-value update
      const [status, id] = values;
      const ticket = mockDatabase.teller_tickets.find((t) => t.id === id);
      if (ticket) ticket.status = status;
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

  // faq_query_log and faq_kb_proposals — no-op in mock (real data only in Supabase)
  if (
    rawSql.includes('INSERT INTO faq_query_log') ||
    rawSql.includes('INSERT INTO faq_kb_proposals')
  ) {
    return [{ inserted: true }];
  }

  // agent_performance_log — INSERT and UPDATE both no-op in mock
  if (rawSql.includes('INSERT INTO agent_performance_log')) {
    return [{ inserted: true }];
  }
  if (rawSql.includes('UPDATE agent_performance_log')) {
    return [{ updated: true }];
  }

  // agent_config — return empty rows so configService uses built-in defaults
  if (rawSql.includes('FROM agent_config')) {
    return [];
  }

  // system radar — transactions JOIN accounts for recent failures (systemController)
  if (rawSql.includes('FROM transactions t') && rawSql.includes('JOIN accounts a')) {
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const results = [];
    for (const tx of mockDatabase.transactions) {
      if (!tx.error_code) continue;
      if (new Date(tx.created_at) < cutoff24h) continue;
      const acc = mockDatabase.accounts.find((a) => a.id === tx.account_id && !a.pan_linked);
      if (!acc) continue;
      results.push({
        tx_id: tx.id, amount: tx.amount, error_code: tx.error_code,
        created_at: tx.created_at, account_number: acc.account_number,
        full_name: acc.full_name, pan_linked: acc.pan_linked,
      });
    }
    return results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 20);
  }

  // ── Sandbox seeding & reset ─────────────────────────────────────────────

  // SELECT id FROM accounts WHERE account_number (sandbox seed lookup)
  if (rawSql.includes('SELECT id FROM accounts WHERE account_number')) {
    const accNum = values[0];
    return mockDatabase.accounts.filter((a) => a.account_number === accNum).map((a) => ({ id: a.id }));
  }

  // INSERT INTO accounts ... ON CONFLICT (sandbox UPSERT)
  if (rawSql.includes('INSERT INTO accounts') && rawSql.includes('ON CONFLICT')) {
    const [id, userId, accountNumber, fullName, email, balance, panLinked, panNumber] = values;
    const existing = mockDatabase.accounts.find((a) => a.account_number === accountNumber);
    if (existing) {
      existing.full_name  = fullName;
      existing.email      = email;
      existing.balance    = Number(balance);
      existing.pan_linked = panLinked;
      existing.pan_number = panNumber ?? null;
    } else {
      mockDatabase.accounts.push({
        id,
        user_id: userId,
        account_number: accountNumber,
        full_name: fullName,
        email,
        balance: Number(balance),
        pan_linked: panLinked,
        pan_number: panNumber ?? null,
      });
    }
    return [{ id, account_number: accountNumber }];
  }

  // DELETE FROM transactions WHERE account_id (sandbox purge before re-seed)
  if (rawSql.includes('DELETE FROM transactions WHERE account_id')) {
    const accountId = values[0];
    const before = mockDatabase.transactions.length;
    mockDatabase.transactions = mockDatabase.transactions.filter((t) => t.account_id !== accountId);
    return [{ deleted: before - mockDatabase.transactions.length }];
  }

  // INSERT INTO transactions (sandbox injection — id, account_id, amount, error_code, created_at)
  if (rawSql.includes('INSERT INTO transactions')) {
    const [id, accountId, amount, errorCode, createdAt] = values;
    const newTx = {
      id,
      account_id: accountId,
      amount: Number(amount),
      error_code: errorCode ?? null,
      created_at: new Date(createdAt),
    };
    mockDatabase.transactions.push(newTx);
    return [{ id }];
  }

  // DELETE FROM teller_tickets (sandbox reset & ticket seeding purge)
  if (rawSql.includes('DELETE FROM teller_tickets')) {
    if (rawSql.includes('WHERE account_id')) {
      const accountId = values[0];
      mockDatabase.teller_tickets = mockDatabase.teller_tickets.filter((t) => t.account_id !== accountId);
      return [{ deleted: true }];
    }
    mockDatabase.teller_tickets = [];
    return [{ deleted: true }];
  }

  // DELETE FROM audit_logs (sandbox reset)
  if (rawSql.includes('DELETE FROM audit_logs')) {
    mockDatabase.audit_logs = [];
    return [{ deleted: true }];
  }

  // DELETE FROM transactions (sandbox global reset — no WHERE clause)
  if (rawSql.includes('DELETE FROM transactions')) {
    mockDatabase.transactions = [];
    return [{ deleted: true }];
  }

  // GET /api/sandbox/ledger — accounts with active ticket count
  if (rawSql.includes('COUNT(t.id)') && rawSql.includes('active_tickets')) {
    return mockDatabase.accounts.map((a) => {
      const activeTickets = mockDatabase.teller_tickets.filter(
        (t) => t.account_id === a.id && ['PENDING', 'PENDING_MANUAL_REVIEW'].includes(t.status)
      ).length;
      return {
        id: a.id,
        account_number: a.account_number,
        full_name: a.full_name,
        balance: a.balance,
        pan_linked: a.pan_linked,
        active_tickets: activeTickets,
      };
    }).sort((a, b) => a.account_number.localeCompare(b.account_number));
  }

  // GET /api/sandbox/ledger — most recent transaction per account (DISTINCT ON)
  if (rawSql.includes('DISTINCT ON') && rawSql.includes('account_id')) {
    const latestByAccount = {};
    for (const tx of mockDatabase.transactions) {
      const existing = latestByAccount[tx.account_id];
      if (!existing || new Date(tx.created_at) > new Date(existing.created_at)) {
        latestByAccount[tx.account_id] = tx;
      }
    }
    return Object.values(latestByAccount);
  }

  return [];
}

export default query;
