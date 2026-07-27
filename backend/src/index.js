import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import authRoutes from './routes/authRoutes.js';
import mobileRoutes from './routes/mobileRoutes.js';
import tellerRoutes from './routes/tellerRoutes.js';
import kioskRoutes from './routes/kioskRoutes.js';
import systemRoutes from './routes/systemRoutes.js';
import sandboxRoutes, { chaosInterceptor } from './routes/sandboxRoutes.js';
import debugRoutes from './routes/debugRoutes.js';
import { query } from './db/index.js';
import { set as redisSet, get as redisGet } from './cache/redisClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// Default env fallbacks for local dev if missing
process.env.JWT_SECRET = process.env.JWT_SECRET || 'torii-secret-key-123456789';
process.env.DOMAIN = process.env.DOMAIN || 'localhost:5173';

// ── Startup credential check ──────────────────────────────────────────────────
// Logs a clear warning for every missing production credential so you know
// exactly which services will fail BEFORE the first real request hits them.
// Nothing is silently swallowed — missing creds = real errors at call time.
(function checkCredentials() {
  const required = [
    ['SUPABASE_DB_URL',               'PostgreSQL — all DB reads/writes will use in-memory mock'],
    ['SUPABASE_URL',                  'Supabase Storage — image uploads will use mock path'],
    ['SUPABASE_SERVICE_ROLE_KEY',     'Supabase Storage — signed URL generation will use placeholder'],
    ['REDIS_URL',                     'Upstash Redis — sessions/OTP will use in-memory Map (not safe for multi-instance)'],
    ['REDIS_TOKEN',                   'Upstash Redis — sessions/OTP will use in-memory Map'],
    ['WATSONX_ORCHESTRATE_API_KEY',   'IBM watsonx Orchestrate — ALL AI agent calls will THROW (no silent fallback)'],
    ['WATSONX_ORCHESTRATE_ENDPOINT',  'IBM watsonx Orchestrate — ALL AI agent calls will THROW (no silent fallback)'],
  ];

  // Email is optional — warn only if NO delivery channel is configured at all
  const hasEmail = process.env.SMTP_HOST || process.env.RESEND_API_KEY || process.env.NOTIFICATION_GATEWAY_URL;
  if (!hasEmail) {
    required.push(['SMTP_HOST (or RESEND_API_KEY)', 'Email — OTP delivery will fall back to console log only']);
  }

  const missing = required.filter(([key]) => !process.env[key]);
  if (missing.length === 0) {
    console.info('[TORII] ✓ All credentials present — running against live services');
    return;
  }

  console.warn('\n[TORII] ⚠ Missing environment variables:');
  missing.forEach(([key, impact]) => {
    console.warn(`  ✗ ${key.padEnd(34)} → ${impact}`);
  });
  console.warn('[TORII] Copy .env.example to .env and fill in the values.\n');
})();
// ──────────────────────────────────────────────────────────────────────────────

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Health Check — includes live DB + Redis connectivity probe
app.get('/api/health', async (req, res) => {
  const checks = {
    db:    { status: 'unknown', source: process.env.SUPABASE_DB_URL ? 'supabase' : 'mock' },
    redis: { status: 'unknown', source: (process.env.REDIS_URL && process.env.REDIS_TOKEN) ? 'upstash' : 'mock' },
  };

  // DB probe — fast SELECT 1
  try {
    await Promise.race([
      query`SELECT 1 AS ping`,
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000)),
    ]);
    checks.db.status = 'ok';
  } catch (err) {
    checks.db.status = 'error';
    checks.db.error = err.message;
  }

  // Redis probe — set + get a throwaway key
  try {
    await Promise.race([
      (async () => {
        await redisSet('health:ping', 'pong', { ex: 10 });
        const v = await redisGet('health:ping');
        if (v !== 'pong') throw new Error(`expected 'pong', got '${v}'`);
      })(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000)),
    ]);
    checks.redis.status = 'ok';
  } catch (err) {
    checks.redis.status = 'error';
    checks.redis.error = err.message;
  }

  const allOk = checks.db.status === 'ok' && checks.redis.status === 'ok';
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'OK' : 'DEGRADED',
    system: 'TORII Compliance Engine',
    timestamp: new Date(),
    checks,
    env: {
      NODE_ENV: process.env.NODE_ENV || 'development',
      DB: checks.db.source,
      REDIS: checks.redis.source,
      EMAIL: process.env.SMTP_HOST ? 'smtp' : (process.env.RESEND_API_KEY ? 'resend' : (process.env.NOTIFICATION_GATEWAY_URL ? 'gateway' : 'console')),
      DOMAIN: process.env.DOMAIN || '(default)',
    },
  });
});

// Sandbox-only: mount chaos interceptor on CBS-facing routes before handlers.
// chaosInterceptor reads Redis key `chaos:rules` and injects latency or errors.
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/auth', chaosInterceptor());
  app.use('/api/kiosk', chaosInterceptor());
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/mobile', mobileRoutes);
app.use('/api/teller', tellerRoutes);
app.use('/api/kiosk', kioskRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/debug', debugRoutes);

// Sandbox control plane — dev/test only
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/sandbox', sandboxRoutes);
}

// Mobile QR fallback redirect — if someone opens /mobile/:token directly on backend port 5000
app.get('/mobile/:token', (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return res.redirect(`${frontendUrl.replace(/\/$/, '')}/mobile/${req.params.token}`);
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[TORII Server Error]', err);
  res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR', message: err.message });
});

// ── Dev-only: generate a TELLER JWT for dashboard testing ─────────────────────
// Usage: POST /api/dev/teller-token
// Returns a signed JWT with role=TELLER — paste into browser localStorage or
// use with any REST client to test the teller dashboard API.
if (process.env.NODE_ENV !== 'production') {
  app.post('/api/dev/teller-token', (req, res) => {
    const now = Math.floor(Date.now() / 1000);
    const token = jwt.sign(
      {
        sub: 'teller-dev-user-0001',
        name: 'Dev Teller',
        role: 'TELLER',
        jti: uuidv4(),
        iat: now,
        exp: now + 28800, // 8 hours
      },
      process.env.JWT_SECRET || 'torii-secret-key-123456789'
    );
    res.json({
      teller_jwt: token,
      note: 'Add as Authorization: Bearer <token> header. Valid for 8 hours. Dev mode only.',
    });
  });

  // ── Dev-only: single-call kiosk bypass ───────────────────────────────────
  // GET /api/dev/kiosk-bypass?account_number=1000000001
  // Requests OTP, reads it from Redis in-process, verifies it, returns JWT.
  // All in one request — no async race conditions.
  app.get('/api/dev/kiosk-bypass', async (req, res) => {
    try {
      const account_number = req.query.account_number || '1000000001';

      // 1. Look up account
      const accounts = await query`
        SELECT id, email FROM accounts WHERE account_number = ${account_number} LIMIT 1
      `;
      if (!accounts.length) return res.status(404).json({ error: 'account not found' });
      const account = accounts[0];

      // 2. Generate and store OTP directly (bypass email)
      const crypto = await import('crypto');
      const otp = String(crypto.default.randomInt(100000, 999999));
      await redisSet(`otp:${account.id}`, otp, { ex: 300 });

      // 3. Import auth controller logic inline — verify OTP and issue JWT
      const jwt = await import('jsonwebtoken');
      const { v4: uuidv4 } = await import('uuid');
      const { createKioskSession } = await import('./cache/sessionManager.js');

      // Consume OTP
      await redisSet(`otp:${account.id}`, '', { ex: 1 });

      // Fetch failed tx summary
      const txRows = await query`
        SELECT amount, created_at FROM transactions
        WHERE account_id = ${account.id}
          AND error_code = 'ERR_PAN_MISSING_OVER_50K'
          AND created_at >= NOW() - INTERVAL '24 hours'
        ORDER BY created_at DESC
      `;
      const failed_tx_summary = txRows.length ? {
        count: txRows.length,
        most_recent_amount: Number(txRows[0].amount),
        most_recent_created_at: txRows[0].created_at,
      } : null;

      // Issue JWT
      const jti = uuidv4();
      const now = Math.floor(Date.now() / 1000);
      const token = jwt.default.sign(
        {
          sub: account.id,
          account_number: String(account_number).slice(-4),
          role: 'CUSTOMER',
          jti,
          iat: now,
          exp: now + 2100,
        },
        process.env.JWT_SECRET || 'torii-secret-key-123456789'
      );

      // Create Redis session
      await createKioskSession(account.id, jti);

      res.json({
        jwt: token,
        failed_tx_summary,
        account_number,
        note: 'Dev bypass — single call, no email. Never use in production.',
      });
    } catch (err) {
      console.error('[dev/kiosk-bypass]', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Dev-only: peek at the current OTP (legacy, kept for curl testing) ────
  app.get('/api/dev/peek-otp', async (req, res) => {
    try {
      const { account_number } = req.query;
      if (!account_number) return res.status(400).json({ error: 'account_number required' });
      const accounts = await query`
        SELECT id FROM accounts WHERE account_number = ${account_number} LIMIT 1
      `;
      if (!accounts.length) return res.status(404).json({ error: 'account not found' });
      const otp = await redisGet(`otp:${accounts[0].id}`);
      if (!otp) return res.status(404).json({ error: 'no active OTP' });
      res.json({ otp: String(otp), account_number });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[TORII Engine] Backend API running on port ${PORT}`);
  });
}

export default app;
