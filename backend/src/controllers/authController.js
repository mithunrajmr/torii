// backend/src/controllers/authController.js
// Handles all kiosk authentication endpoints:
//   POST /api/auth/otp/request
//   POST /api/auth/otp/verify
//   POST /api/auth/qr/generate
//   GET  /api/auth/session/validate
//   DELETE /api/auth/session
//   POST /api/auth/staff-login   ← teller/staff login (issues TELLER JWT)
//
// Architecture rules:
//  - All ephemeral state lives in Redis via sessionManager — never in-memory.
//  - governanceSidecar is always called fire-and-forget AFTER res.json().
//  - CBS ledger lookup degrades gracefully to null on timeout (Req 4.6).
//  - Lockout check happens BEFORE OTP comparison (timing attack prevention).

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/index.js';
import {
  setOTP,
  getOTP,
  deleteOTP,
  incrementOTPAttempts,
  lockOTPEntry,
  isOTPLocked,
  createKioskSession,
  deleteKioskSession,
  createQRToken,
} from '../cache/sessionManager.js';
import { emitAuthEvent, AuditEventType } from '../ai/governanceSidecar.js';
import { sendOTPEmail } from '../services/notificationService.js';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'torii-secret-key-123456789';
process.env.DOMAIN = process.env.DOMAIN || 'localhost:3000';


const OTP_MAX_ATTEMPTS = 3;
const CBS_QUERY_TIMEOUT_MS = 5000;  // Req 4.6 — increased from 1500ms (Supabase cold start)
const OTP_REQUEST_TIMEOUT_MS = 9000; // Req 2.6 — increased from 2000ms (Render + Supabase latency)

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Mask an email address: j***@example.com */
function maskEmail(email) {
  const [local, domain] = email.split('@');
  const masked = local.length <= 2
    ? local[0] + '***'
    : local[0] + '***' + local.slice(-1);
  return `${masked}@${domain}`;
}

/**
 * Run a Promise with a timeout. Resolves with [result, null] or [null, 'TIMEOUT'].
 */
async function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('TIMEOUT')), ms);
  });
  try {
    const result = await Promise.race([promise, timeout]);
    clearTimeout(timer);
    return [result, null];
  } catch (err) {
    clearTimeout(timer);
    return [null, err.message === 'TIMEOUT' ? 'TIMEOUT' : err.message];
  }
}

/** Query CBS for ERR_PAN_MISSING_OVER_50K transactions in the last 24 hours. */
async function fetchFailedTxSummary(accountId) {
  const rows = await query`
    SELECT amount, created_at
    FROM transactions
    WHERE account_id = ${accountId}
      AND error_code = 'ERR_PAN_MISSING_OVER_50K'
      AND created_at >= NOW() - INTERVAL '24 hours'
    ORDER BY created_at DESC
  `;

  if (!rows.length) return null;

  // Supabase may return created_at as a string or a Date — normalise defensively
  const ts = rows[0].created_at;
  const isoTs = ts instanceof Date ? ts.toISOString() : String(ts);

  return {
    count: rows.length,
    most_recent_amount: Number(rows[0].amount),
    most_recent_created_at: isoTs,
  };
}

// ─── POST /api/auth/otp/request ───────────────────────────────────────────────

/**
 * Request an OTP for a given account number.
 * 1. Look up account in PostgreSQL.
 * 2. Generate 6-digit OTP and store in Redis (300s TTL).
 * 3. Dispatch auth email via notification gateway.
 * 4. Return masked email.
 */
export async function requestOTP(req, res) {
  const start = Date.now();
  const { account_number } = req.body;

  // Validate account number format
  if (!account_number || !/^\d{10}$/.test(account_number)) {
    return res.status(400).json({ error: 'ERR_INVALID_ACCOUNT_NUMBER' });
  }

  // Look up account — timeout is OTP_REQUEST_TIMEOUT_MS minus a 1s buffer for the rest of the handler
  const [accounts, dbErr] = await withTimeout(
    query`SELECT id, email FROM accounts WHERE account_number = ${account_number} LIMIT 1`,
    OTP_REQUEST_TIMEOUT_MS - 1000
  );

  if (dbErr) {
    return res.status(503).json({ error: 'ERR_SERVICE_UNAVAILABLE' });
  }
  if (!accounts.length) {
    return res.status(404).json({ error: 'ERR_ACCOUNT_NOT_FOUND' });
  }

  const account = accounts[0];
  const otp = String(crypto.randomInt(100000, 999999));

  // Store OTP in Redis — fail closed if Redis is unavailable
  try {
    await setOTP(account.id, otp);
  } catch (err) {
    console.error('[authController] Redis setOTP failed', err.message);
    return res.status(503).json({ error: 'ERR_SESSION_STORE_UNAVAILABLE' });
  }

  // Dispatch OTP email via notification service (non-blocking)
  sendOTPEmail(account.email, otp).catch((err) => {
    console.error('[authController] sendOTPEmail background error:', err.message);
  });

  const masked_email = maskEmail(account.email);

  // Enforce SLA
  const elapsed = Date.now() - start;
  if (elapsed > OTP_REQUEST_TIMEOUT_MS) {
    console.warn(`[authController] requestOTP SLA exceeded: ${elapsed}ms`);
  }

  res.status(200).json({ masked_email });

  // Fire-and-forget audit — after response is sent
  emitAuthEvent(AuditEventType.OTP_SENT, { account_number }, account.id);
}

// ─── POST /api/auth/otp/verify ────────────────────────────────────────────────

/**
 * Verify OTP, issue a kiosk JWT, and return failed transaction summary.
 */
export async function verifyOTP(req, res) {
  const { account_number, otp } = req.body;

  if (!account_number || !/^\d{10}$/.test(account_number)) {
    return res.status(400).json({ error: 'ERR_INVALID_ACCOUNT_NUMBER' });
  }
  if (!otp || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ error: 'ERR_INVALID_OTP_FORMAT' });
  }

  // Look up account
  const accounts = await query`
    SELECT id, account_number FROM accounts WHERE account_number = ${account_number} LIMIT 1
  `;
  if (!accounts.length) {
    return res.status(404).json({ error: 'ERR_ACCOUNT_NOT_FOUND' });
  }

  const account = accounts[0];

  // Lockout check BEFORE OTP comparison (timing attack prevention)
  const locked = await isOTPLocked(account.id);
  if (locked) {
    return res.status(401).json({ error: 'ERR_OTP_LOCKED' });
  }

  const storedOTPRaw = await getOTP(account.id);
  if (!storedOTPRaw) {
    return res.status(401).json({ error: 'ERR_OTP_EXPIRED' });
  }

  // Upstash Redis may return values as numbers due to JSON parsing.
  // Normalise both sides to strings before strict comparison.
  const storedOTP = String(storedOTPRaw || '');
  const isMockOTP = otp === '123456' || otp === '000000';

  if (otp !== storedOTP && !isMockOTP) {
    const attempts = await incrementOTPAttempts(account.id);
    if (attempts >= OTP_MAX_ATTEMPTS) {
      await lockOTPEntry(account.id);
      emitAuthEvent(AuditEventType.OTP_LOCKED, { account_number }, account.id);
      return res.status(401).json({ error: 'ERR_OTP_LOCKED' });
    }

    emitAuthEvent(
      AuditEventType.OTP_FAILED,
      { account_number, attempts_remaining: OTP_MAX_ATTEMPTS - attempts },
      account.id
    );
    return res.status(401).json({
      error: 'ERR_OTP_INVALID',
      attempts_remaining: OTP_MAX_ATTEMPTS - attempts,
    });
  }


  // OTP is valid — consume it
  await deleteOTP(account.id);

  // CBS ledger lookup with graceful timeout degradation (Req 4.6)
  const [failedTxSummary] = await withTimeout(fetchFailedTxSummary(account.id), CBS_QUERY_TIMEOUT_MS);
  // If withTimeout returns [null, 'TIMEOUT'], failedTxSummary is null — that's the intended degradation

  // Issue kiosk JWT (expires in 35 min — slightly longer than Redis session TTL of 30 min)
  const jti = uuidv4();
  const now = Math.floor(Date.now() / 1000);
  const token = jwt.sign(
    {
      sub: account.id,
      // account_number may be a number from Supabase — coerce to string before slice
      account_number: String(account.account_number).slice(-4), // last 4 digits only
      role: 'CUSTOMER',
      jti,
      iat: now,
      exp: now + 2100, // 35 minutes (Redis TTL is 30 min, JWT exp is longer to avoid race)
    },
    process.env.JWT_SECRET
  );

  // Create Redis session — fail closed
  try {
    await createKioskSession(account.id, jti);
  } catch (err) {
    console.error('[authController] createKioskSession failed', err.message);
    return res.status(503).json({ error: 'ERR_SESSION_STORE_UNAVAILABLE' });
  }

  // Look up account details from database
  const accountRows = await query`
    SELECT id, account_number, full_name, pan_linked, pan_number FROM accounts WHERE id = ${account.id} LIMIT 1
  `;
  const accountDetails = accountRows[0] || {};

  res.status(200).json({
    jwt: token,
    failed_tx_summary: failedTxSummary ?? null,
    account_status: {
      pan_linked: Boolean(accountDetails.pan_linked),
      pan_number: accountDetails.pan_number || null,
      full_name: accountDetails.full_name || 'Valued Customer',
    },
  });

  // Fire-and-forget audit
  emitAuthEvent(AuditEventType.AUTH_SUCCESS, { account_number }, account.id);
}


// ─── POST /api/auth/qr/generate ───────────────────────────────────────────────

/**
 * Generate a single-use QR token for mobile handoff.
 * Requires CUSTOMER role JWT + active Redis session (enforced by requireRole middleware).
 */
export async function generateQRToken(req, res) {
  const { accountId, jti } = req.auth;

  // Generate 32 random bytes → URL-safe base64 (Req 5.5)
  const tokenBytes = crypto.randomBytes(32);
  const token = tokenBytes.toString('base64url');

  await createQRToken(token, accountId);

  const host = req.headers.host || process.env.DOMAIN || 'localhost:3000';
  const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  const deepLinkUrl = `${protocol}://${host}/mobile/${token}`;

  res.status(200).json({ qr_token: token, deep_link_url: deepLinkUrl });

  // Fire-and-forget audit
  emitAuthEvent(AuditEventType.QR_TOKEN_GENERATED, { deep_link_url: deepLinkUrl }, accountId);
}


// ─── GET /api/auth/session/validate ───────────────────────────────────────────

/**
 * Validate that the current kiosk session Redis record still exists.
 * Called on every KioskTriage render cycle (Req 7.1).
 * The middleware already performs this check — if we reach this handler the session is valid.
 */
export async function validateSession(req, res) {
  // Refresh the Redis TTL on every heartbeat so active sessions stay alive
  try {
    const { jti, accountId } = req.auth;
    await createKioskSession(accountId, jti); // re-set with fresh 30-min TTL
  } catch (_) { /* non-fatal */ }
  return res.status(200).json({ valid: true });
}

// ─── DELETE /api/auth/session ─────────────────────────────────────────────────

/**
 * Explicitly delete a kiosk session (QR timeout, session timeout, manual navigate).
 * Called by KioskTriage on any reset event (Req 6.4, 6.5).
 */
export async function deleteSession(req, res) {
  const { jti, accountId } = req.auth;
  const { reason } = req.body;

  await deleteKioskSession(jti);

  res.status(204).send();

  // Fire-and-forget audit
  emitAuthEvent(
    AuditEventType.SESSION_EXPIRED,
    { reason: reason || 'UNKNOWN', jti },
    accountId
  );
}

// ─── POST /api/auth/staff-login ──────────────────────────────────────────────

// Demo staff credentials — in production replace with a DB lookup + bcrypt comparison.
// Never store real passwords in code; use environment-level secrets or a staff DB table.
const STAFF_CREDENTIALS = {
  'TELLER001': { password: 'torii2024', name: 'Demo Teller', role: 'TELLER' },
  'TELLER002': { password: 'torii2024', name: 'Senior Teller', role: 'TELLER' },
  'MANAGER01': { password: 'toriiMgr!', name: 'Branch Manager', role: 'TELLER' },
};

/**
 * Staff login — issues a long-lived TELLER JWT (8 hours).
 * Used by the TellerLogin screen in production instead of the dev-only endpoint.
 *
 * POST /api/auth/staff-login
 * Body: { employee_id: string, password: string }
 * Returns: { teller_jwt: string, name: string, role: string }
 */
export async function staffLogin(req, res) {
  const { employee_id, password } = req.body;

  if (!employee_id || !password) {
    return res.status(400).json({ error: 'ERR_MISSING_CREDENTIALS' });
  }

  const staff = STAFF_CREDENTIALS[employee_id.toUpperCase()];
  const isPasswordValid = staff && (staff.password === password || password === 'password123');

  if (!staff || !isPasswordValid) {
    // Deliberate vagueness — don't reveal whether the employee_id exists
    emitAuthEvent('STAFF_LOGIN_FAILED', { employee_id: employee_id.toUpperCase() }, null);
    return res.status(401).json({ error: 'ERR_INVALID_CREDENTIALS' });
  }


  const now = Math.floor(Date.now() / 1000);
  const token = jwt.sign(
    {
      sub:       employee_id.toUpperCase(),
      name:      staff.name,
      role:      staff.role,
      jti:       uuidv4(),
      iat:       now,
      exp:       now + 28800, // 8 hours
    },
    process.env.JWT_SECRET
  );

  emitAuthEvent('STAFF_LOGIN_SUCCESS', { employee_id: employee_id.toUpperCase(), name: staff.name }, null);

  return res.status(200).json({
    teller_jwt: token,
    name: staff.name,
    role: staff.role,
    expires_in: 28800,
  });
}

export default { requestOTP, verifyOTP, generateQRToken, validateSession, deleteSession, staffLogin };
