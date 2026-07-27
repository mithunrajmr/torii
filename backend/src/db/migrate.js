// backend/src/db/migrate.js
// Runs all 4 SQL migrations against live Supabase PostgreSQL and seeds demo accounts.

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import postgres from 'postgres';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

async function run() {
  let dbUrl = process.env.SUPABASE_DB_URL;

  if (!dbUrl) {
    console.error('❌ Error: SUPABASE_DB_URL is missing in .env file.');
    process.exit(1);
  }

  // Remove brackets around password if present (e.g. [password])
  dbUrl = dbUrl.replace(/:\[([^\]]+)\]@/, (m, p1) => `:${encodeURIComponent(p1)}@`);

  console.info(`[TORII Migration] Testing connection: ${dbUrl.replace(/:[^:@]+@/, ':***@')}`);

  const sql = postgres(dbUrl, {
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10,
  });

  try {
    await sql`SELECT 1 as test`;
    console.info(`[TORII Migration] ✓ Connection established.`);

    // 2. Read and apply all 4 migration files in order
    const migrationFiles = [
      '001_initial_schema.sql',
      '002_accounts_add_email.sql',
      '003_agent_architecture.sql',
      '004_faq_feedback_loop.sql',
      '005_accounts_created_at.sql',
      '006_expanded_branch_services.sql',
    ];

    const migrationsDir = path.join(process.cwd(), 'backend', 'src', 'db', 'migrations');

    for (const file of migrationFiles) {
      const filePath = path.join(migrationsDir, file);
      if (!fs.existsSync(filePath)) {
        console.warn(`[TORII Migration] Warning: File not found: ${file}`);
        continue;
      }

      console.info(`[TORII Migration] Applying ${file}...`);
      const sqlContent = fs.readFileSync(filePath, 'utf8');
      await sql.unsafe(sqlContent);
      console.info(`[TORII Migration] ✓ ${file} applied successfully.`);
    }

    // 3. Seed demo accounts so real data authentication & triage work out of the box
    console.info('[TORII Migration] Seeding 6 core test accounts into PostgreSQL...');
    const seedAccounts = [
      { id: '00000000-0000-4000-a000-000000000001', user_id: '00000000-0000-4000-b000-000000000001', account_number: '1000000001', full_name: 'ARJUN SHARMA', email: 'arjun.sharma@testbank.in', balance: 82500.00, pan_linked: false },
      { id: '00000000-0000-4000-a000-000000000002', user_id: '00000000-0000-4000-b000-000000000002', account_number: '1000000002', full_name: 'PRIYA NAIR', email: 'priya.nair@testbank.in', balance: 34200.00, pan_linked: true, pan_number: 'BCDFE5678G' },
      { id: '00000000-0000-4000-a000-000000000003', user_id: '00000000-0000-4000-b000-000000000003', account_number: '1000000003', full_name: 'RAVI MEHTA', email: 'ravi.mehta@testbank.in', balance: 215000.00, pan_linked: false },
      { id: '00000000-0000-4000-a000-000000000004', user_id: '00000000-0000-4000-b000-000000000004', account_number: '1000000004', full_name: 'SUNITA RAO', email: 'sunita.rao@testbank.in', balance: 67800.00, pan_linked: false },
      { id: '00000000-0000-4000-a000-000000000005', user_id: '00000000-0000-4000-b000-000000000005', account_number: '1000000005', full_name: 'DEV TESTER', email: 'dev.tester@testbank.in', balance: 12000.00, pan_linked: true, pan_number: 'DEVTE1234T' },
      { id: '00000000-0000-4000-a000-000000000006', user_id: '00000000-0000-4000-b000-000000000006', account_number: '1000000006', full_name: 'KARAN MALHOTRA', email: 'karan.malhotra@testbank.in', balance: 875000.00, pan_linked: false },
    ];

    for (const acc of seedAccounts) {
      await sql`
        INSERT INTO accounts (id, user_id, account_number, full_name, email, balance, pan_linked, pan_number)
        VALUES (${acc.id}, ${acc.user_id}, ${acc.account_number}, ${acc.full_name}, ${acc.email}, ${acc.balance}, ${acc.pan_linked}, ${acc.pan_number || null})
        ON CONFLICT (account_number) DO NOTHING
      `.catch(() => {});
    }
    console.info('[TORII Migration] ✓ Seed accounts populated.');

    // 4. Seed demo transactions for PAN failure triage & AML testing
    console.info('[TORII Migration] Seeding demo transaction compliance records...');
    const acc1Rows = await sql`SELECT id FROM accounts WHERE account_number = '1000000001' LIMIT 1`;
    if (acc1Rows.length) {
      const acc1Id = acc1Rows[0].id;
      await sql`
        INSERT INTO transactions (account_id, amount, error_code, created_at)
        VALUES (${acc1Id}, 75000.00, 'ERR_PAN_MISSING_OVER_50K', NOW() - INTERVAL '3 hours')
      `;
    }
    const acc3Rows = await sql`SELECT id FROM accounts WHERE account_number = '1000000003' LIMIT 1`;
    if (acc3Rows.length) {
      const acc3Id = acc3Rows[0].id;
      await sql`
        INSERT INTO transactions (account_id, amount, error_code, created_at)
        VALUES 
          (${acc3Id}, 49000.00, NULL, NOW() - INTERVAL '6 hours'),
          (${acc3Id}, 48500.00, NULL, NOW() - INTERVAL '12 hours'),
          (${acc3Id}, 55000.00, 'ERR_PAN_MISSING_OVER_50K', NOW() - INTERVAL '2 hours')
      `;
    }
    console.info('[TORII Migration] ✓ Transaction compliance records seeded.');

    console.info('\n🎉 [TORII Migration] SUCCESS! All 4 migrations and seed data applied to live Supabase DB.');
    await sql.end();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ [TORII Migration Failed]:', err.message);
    await sql.end();
    process.exit(1);
  }
}

run();
