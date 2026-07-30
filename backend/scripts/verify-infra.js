#!/usr/bin/env node
// backend/scripts/verify-infra.js
// Standalone infrastructure diagnostic script.
// Run: node backend/scripts/verify-infra.js
// Loads .env, probes every external service, prints a summary table.

import 'dotenv/config';
import postgres from 'postgres';
import { Redis } from '@upstash/redis';
import { GoogleGenAI } from '@google/genai';

const RESET  = '\x1b[0m';
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BOLD   = '\x1b[1m';
const CYAN   = '\x1b[36m';

const results = [];

function pass(service, detail = '') {
  results.push({ service, status: 'LIVE', detail });
  console.log(`  ${GREEN}✓ LIVE${RESET}    ${service}${detail ? `  — ${detail}` : ''}`);
}

function fail(service, detail = '') {
  results.push({ service, status: 'FAILING', detail });
  console.log(`  ${RED}✗ FAILING${RESET} ${service}${detail ? `  — ${detail}` : ''}`);
}

function warn(service, detail = '') {
  results.push({ service, status: 'WARN', detail });
  console.log(`  ${YELLOW}⚠ WARN${RESET}    ${service}${detail ? `  — ${detail}` : ''}`);
}

function section(title) {
  console.log(`\n${BOLD}${CYAN}── ${title} ${'─'.repeat(Math.max(0, 50 - title.length))}${RESET}`);
}

// ── 1. PostgreSQL (Supabase) ──────────────────────────────────────────────────
async function checkDatabase() {
  section('PostgreSQL / Supabase');
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    fail('PostgreSQL', 'SUPABASE_DB_URL not set — mock DB active');
    return;
  }
  let sql;
  try {
    sql = postgres(url, { ssl: { rejectUnauthorized: false }, connect_timeout: 8 });
    const [ping] = await sql`SELECT 1 AS health_check`;
    if (ping.health_check !== 1) throw new Error('Unexpected SELECT 1 result');

    const [countRow] = await sql`SELECT count(*)::int AS total FROM accounts`;
    pass('PostgreSQL', `SELECT 1 OK · accounts table has ${countRow.total} rows`);
  } catch (err) {
    fail('PostgreSQL', err.message.slice(0, 120));
  } finally {
    if (sql) await sql.end().catch(() => {});
  }
}

// ── 2. Upstash Redis ──────────────────────────────────────────────────────────
async function checkRedis() {
  section('Upstash Redis');
  const url   = process.env.REDIS_URL;
  const token = process.env.REDIS_TOKEN;
  if (!url || !token) {
    fail('Redis', 'REDIS_URL or REDIS_TOKEN not set — in-memory mock active');
    return;
  }
  try {
    const client = new Redis({ url, token });
    await client.set('diagnostic:test', 'torii-ping', { ex: 30 });
    const val = await client.get('diagnostic:test');
    if (val !== 'torii-ping') throw new Error(`GET returned unexpected value: ${val}`);
    await client.del('diagnostic:test');
    pass('Redis', 'SET/GET/DEL cycle successful');
  } catch (err) {
    fail('Redis', err.message.slice(0, 120));
  }
}

// ── 3. Supabase Storage (Service Role Key validation) ─────────────────────────
async function checkSupabaseStorage() {
  section('Supabase Storage');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url  = process.env.SUPABASE_URL;

  if (!key) {
    fail('Supabase Storage', 'SUPABASE_SERVICE_ROLE_KEY not set');
    return;
  }

  // A real Supabase service role key is a JWT — starts with "eyJ" and is >150 chars
  const isJWT = key.startsWith('eyJ') && key.length > 150;
  if (!isJWT) {
    warn(
      'Supabase Storage',
      `Key looks like a placeholder (len=${key.length}, prefix="${key.slice(0, 9)}..."). ` +
      'Real service role keys start with "eyJ" and are ~200+ chars. ' +
      'Storage uploads & signed URLs WILL FAIL in production until a valid key is set.'
    );
  } else {
    pass('Supabase Storage', `Service role key looks valid (JWT, len=${key.length})`);
  }

  // Optional: ping Supabase REST API to confirm URL is reachable
  if (url) {
    try {
      const res = await fetch(`${url}/rest/v1/`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok || res.status === 200 || res.status === 404) {
        pass('Supabase REST API', `Reachable — HTTP ${res.status}`);
      } else {
        warn('Supabase REST API', `HTTP ${res.status} — credentials may be wrong`);
      }
    } catch (err) {
      fail('Supabase REST API', err.message.slice(0, 80));
    }
  }
}

// ── 4. Google Gemini ──────────────────────────────────────────────────────────
async function checkGemini() {
  section('Google Gemini Flash');
  const apiKey = process.env.GEMINI_API_KEY;
  const model  = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

  if (!apiKey) {
    fail('Gemini', 'GEMINI_API_KEY not set');
    return;
  }

  // Basic format check: real Gemini keys start with "AIza" and are 39 chars
  const looksValid = apiKey.startsWith('AIza') && apiKey.length >= 39;
  if (!looksValid) {
    warn(
      'Gemini (key format)',
      `Key prefix "${apiKey.slice(0, 8)}..." len=${apiKey.length}. ` +
      'Standard API keys start with "AIza" and are 39 chars. ' +
      'Attempting live call anyway…'
    );
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: [{ text: 'Reply with exactly the word: PONG' }],
    });
    const text = (response.text || '').trim();
    if (!text) throw new Error('Empty response from Gemini');
    pass('Gemini', `Live response: "${text.slice(0, 60)}" (model: ${model})`);
  } catch (err) {
    fail('Gemini', err.message.slice(0, 120));
  }
}

// ── 5. IBM watsonx Orchestrate ────────────────────────────────────────────────
async function checkWatsonx() {
  section('IBM watsonx Orchestrate');
  const apiKey   = process.env.WATSONX_ORCHESTRATE_API_KEY;
  const endpoint = process.env.WATSONX_ORCHESTRATE_ENDPOINT;

  if (!apiKey || !endpoint) {
    fail('watsonx Orchestrate', 'WATSONX_ORCHESTRATE_API_KEY or ENDPOINT not set');
    return;
  }

  // Check agent IDs
  const agentVars = {
    WXO_VISION_AGENT_ID:       process.env.WXO_VISION_AGENT_ID,
    WXO_WATCHDOG_AGENT_ID:     process.env.WXO_WATCHDOG_AGENT_ID,
    WXO_ADVISOR_AGENT_ID:      process.env.WXO_ADVISOR_AGENT_ID,
    WXO_FAQ_AGENT_ID:          process.env.WXO_FAQ_AGENT_ID,
    WXO_LOCALIZER_AGENT_ID:    process.env.WXO_LOCALIZER_AGENT_ID,
    WXO_ORCHESTRATOR_AGENT_ID: process.env.WXO_ORCHESTRATOR_AGENT_ID,
  };

  const missing = Object.entries(agentVars).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0) {
    warn('watsonx Agent IDs', `Missing: ${missing.join(', ')}`);
  } else {
    pass('watsonx Agent IDs', `All 6 agent IDs populated`);
  }

  // Ping IAM token endpoint
  try {
    const body = new URLSearchParams({
      grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
      apikey: apiKey,
    });
    const res = await fetch('https://iam.cloud.ibm.com/identity/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(12000),
    });

    if (res.ok) {
      const data = await res.json();
      const expiresIn = data.expires_in || '?';
      pass('watsonx IAM token', `Bearer token issued (expires_in=${expiresIn}s)`);

      // Ping endpoint reachability (list agents or basic GET)
      try {
        const epRes = await fetch(`${endpoint}/v1/orchestrate`, {
          headers: { Authorization: `Bearer ${data.access_token}` },
          signal: AbortSignal.timeout(8000),
        });
        // Any non-5xx response confirms endpoint is reachable
        if (epRes.status < 500) {
          pass('watsonx Endpoint', `${endpoint} — HTTP ${epRes.status}`);
        } else {
          warn('watsonx Endpoint', `HTTP ${epRes.status} — server-side error`);
        }
      } catch (err) {
        fail('watsonx Endpoint', err.message.slice(0, 80));
      }
    } else {
      const text = await res.text();
      fail('watsonx IAM token', `HTTP ${res.status}: ${text.slice(0, 80)}`);
    }
  } catch (err) {
    fail('watsonx IAM token', err.message.slice(0, 120));
  }
}

// ── Summary table ─────────────────────────────────────────────────────────────
function printSummary() {
  console.log(`\n${BOLD}${'═'.repeat(62)}${RESET}`);
  console.log(`${BOLD}  TORII Infrastructure Diagnostic Summary${RESET}`);
  console.log(`${BOLD}${'═'.repeat(62)}${RESET}`);

  const live    = results.filter((r) => r.status === 'LIVE').length;
  const failing = results.filter((r) => r.status === 'FAILING').length;
  const warns   = results.filter((r) => r.status === 'WARN').length;

  for (const r of results) {
    const icon  = r.status === 'LIVE' ? `${GREEN}LIVE   ${RESET}` :
                  r.status === 'WARN' ? `${YELLOW}WARN   ${RESET}` :
                                        `${RED}FAILING${RESET}`;
    const svc   = r.service.padEnd(30);
    console.log(`  ${icon}  ${svc}  ${r.detail ? r.detail.slice(0, 55) : ''}`);
  }

  console.log(`\n  ${GREEN}${live} LIVE${RESET}  ${YELLOW}${warns} WARN${RESET}  ${RED}${failing} FAILING${RESET}`);
  console.log(`${BOLD}${'═'.repeat(62)}${RESET}\n`);

  if (failing > 0) process.exit(1);
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(`\n${BOLD}${CYAN}TORII — Infrastructure Verification Script${RESET}`);
console.log(`Timestamp: ${new Date().toISOString()}\n`);

await checkDatabase();
await checkRedis();
await checkSupabaseStorage();
await checkGemini();
await checkWatsonx();
printSummary();
