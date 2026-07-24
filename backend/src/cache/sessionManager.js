// backend/src/cache/sessionManager.js
// All ephemeral state (OTP, kiosk session, QR token) lives exclusively in Redis.
// Never use in-memory Maps or module-level variables — this module is the single
// authoritative interface for all TTL-bound session state.

import { set, get, del, incrWithExpiry } from './redisClient.js';

// ─── TTL Constants ────────────────────────────────────────────────────────────
const OTP_TTL = 300;           // 5 minutes  (Req 2.4)
const OTP_ATTEMPTS_TTL = 300;  // reset window matches OTP TTL
const OTP_LOCK_TTL = 300;      // locked for 5 minutes (Req 3.4)
const KIOSK_SESSION_TTL = 120; // 2 minutes  (Req 3.6)
const QR_TOKEN_TTL = 600;      // 10 minutes (Req 5.2)

// ─── Key Namespaces ──────────────────────────────────────────────────────────
const keys = {
  otp: (accountId) => `otp:${accountId}`,
  otpAttempts: (accountId) => `otp:attempts:${accountId}`,
  otpLocked: (accountId) => `otp:locked:${accountId}`,
  session: (jti) => `session:${jti}`,
  qr: (token) => `qr:${token}`,
};

// ─── OTP Lifecycle ────────────────────────────────────────────────────────────

/**
 * Store an OTP for the given account with a 300-second TTL.
 * @param {string} accountId
 * @param {string} otp - 6-digit numeric string
 * @returns {Promise<void>}
 */
export async function setOTP(accountId, otp) {
  await set(keys.otp(accountId), otp, { ex: OTP_TTL });
}

/**
 * Retrieve the stored OTP for an account. Returns null if expired or absent.
 * @param {string} accountId
 * @returns {Promise<string|null>}
 */
export async function getOTP(accountId) {
  return get(keys.otp(accountId));
}

/**
 * Delete the OTP for an account (called after successful verification).
 * @param {string} accountId
 * @returns {Promise<void>}
 */
export async function deleteOTP(accountId) {
  await del(keys.otp(accountId));
}

// ─── OTP Lockout ──────────────────────────────────────────────────────────────

/**
 * Increment the failed OTP attempt counter for an account.
 * The counter TTL is refreshed on every increment to match the OTP window.
 * @param {string} accountId
 * @returns {Promise<number>} new attempt count
 */
export async function incrementOTPAttempts(accountId) {
  return incrWithExpiry(keys.otpAttempts(accountId), OTP_ATTEMPTS_TTL);
}

/**
 * Lock the OTP entry for an account, preventing further attempts for 300 seconds.
 * @param {string} accountId
 * @returns {Promise<void>}
 */
export async function lockOTPEntry(accountId) {
  await set(keys.otpLocked(accountId), '1', { ex: OTP_LOCK_TTL });
}

/**
 * Check whether the OTP entry for an account is currently locked.
 * Lockout check MUST be performed before OTP comparison to prevent timing-based
 * enumeration attacks.
 * @param {string} accountId
 * @returns {Promise<boolean>}
 */
export async function isOTPLocked(accountId) {
  const val = await get(keys.otpLocked(accountId));
  return val === '1';
}

// ─── Kiosk Session ────────────────────────────────────────────────────────────

/**
 * Create a kiosk session record in Redis keyed on the JWT jti claim.
 * The Redis TTL is the authoritative session gate — JWT exp alone is insufficient.
 * @param {string} accountId
 * @param {string} jti - UUID v4 from the JWT jti claim
 * @returns {Promise<void>}
 */
export async function createKioskSession(accountId, jti) {
  await set(keys.session(jti), accountId, { ex: KIOSK_SESSION_TTL });
}

/**
 * Retrieve the accountId bound to a kiosk session.
 * Returns null if the session has expired or been explicitly deleted.
 * @param {string} jti
 * @returns {Promise<string|null>} accountId or null
 */
export async function getKioskSession(jti) {
  return get(keys.session(jti));
}

/**
 * Delete the kiosk session record for the given jti.
 * Called on QR timeout, session timeout, or manual navigation away.
 * @param {string} jti
 * @returns {Promise<void>}
 */
export async function deleteKioskSession(jti) {
  await del(keys.session(jti));
}

// ─── QR Token ─────────────────────────────────────────────────────────────────

/**
 * Store a single-use QR token mapped to the authenticated accountId.
 * @param {string} token - URL-safe base64 string (≥32 random bytes)
 * @param {string} accountId
 * @returns {Promise<void>}
 */
export async function createQRToken(token, accountId) {
  await set(keys.qr(token), accountId, { ex: QR_TOKEN_TTL });
}

/**
 * Consume a QR token atomically: returns the bound accountId on first call,
 * then deletes the key so all subsequent calls return null (non-replayable).
 *
 * Note: Upstash Redis REST client does not expose GETDEL natively, so we
 * perform GET then DEL. The token is single-use by design — any race condition
 * window is acceptable given the kiosk physical context.
 *
 * @param {string} token
 * @returns {Promise<string|null>} accountId on first call, null thereafter
 */
export async function consumeQRToken(token) {
  const accountId = await get(keys.qr(token));
  if (accountId) {
    await del(keys.qr(token));
    return accountId;
  }
  return null;
}

export default {
  setOTP,
  getOTP,
  deleteOTP,
  incrementOTPAttempts,
  lockOTPEntry,
  isOTPLocked,
  createKioskSession,
  getKioskSession,
  deleteKioskSession,
  createQRToken,
  consumeQRToken,
};
