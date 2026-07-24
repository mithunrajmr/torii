// backend/src/db/index.js
// Supabase PostgreSQL connection pool with local dev mock fallback.

import postgres from 'postgres';

let sql = null;

// Mock database state for local offline demo
const mockDatabase = {
  accounts: [
    {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      user_id: 'u0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      account_number: '1234567890',
      email: 'john.doe@example.com',
      balance: 75000.00,
      pan_linked: false,
      pan_number: null,
    },
  ],
  transactions: [
    {
      id: 't0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      account_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      amount: 55000.00,
      error_code: 'ERR_PAN_MISSING_OVER_50K',
      created_at: new Date(),
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
    return mockDatabase.transactions.filter(
      (t) => t.account_id === accountId && t.error_code === 'ERR_PAN_MISSING_OVER_50K'
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
    return mockDatabase.teller_tickets;
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
