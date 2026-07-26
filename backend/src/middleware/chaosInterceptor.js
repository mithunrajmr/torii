// backend/src/middleware/chaosInterceptor.js
// Express middleware that injects artificial latency or HTTP error codes into
// simulated Core Banking System (CBS) endpoints.
//
// Activated by chaos rules stored in Redis key `chaos:rules` (set via
// POST /api/sandbox/chaos). Rules persist until explicitly cleared.
//
// Intercepted routes:
//   - /api/auth/*    — kiosk OTP + session endpoints
//   - /api/kiosk/*   — kiosk query pipeline
//
// Rules shape: { cbsDelayMs: number, forceHttpError: number|null }
//
// SAFETY: This middleware is only mounted by sandboxRoutes.js when
// NODE_ENV !== 'production'. It must never reach a production server.

import { get as redisGet } from '../cache/redisClient.js';

// Cache the chaos rules in-process for 1 second to avoid a Redis round-trip
// on every single request. This is acceptable for a dev tool.
let _cachedRules = null;
let _cacheExpiry = 0;
const CACHE_TTL_MS = 1000;

async function _getActiveRules() {
  const now = Date.now();
  if (_cachedRules && now < _cacheExpiry) {
    return _cachedRules;
  }

  try {
    const raw = await redisGet('chaos:rules');
    _cachedRules = raw ? JSON.parse(raw) : null;
    _cacheExpiry = now + CACHE_TTL_MS;
    return _cachedRules;
  } catch {
    // Redis unavailable — fail open (no chaos injected)
    return null;
  }
}

/**
 * Clears the in-process rules cache.
 * Called by tests to force a fresh Redis read after rules change.
 */
export function clearChaosCache() {
  _cachedRules = null;
  _cacheExpiry = 0;
}

/**
 * Express middleware factory.
 * Mount on a specific router or the global app before the target route handlers.
 *
 * @returns {Function} Express middleware (req, res, next)
 */
export function chaosInterceptor() {
  return async function chaosMiddleware(req, res, next) {
    const rules = await _getActiveRules();

    // No rules or all rules are zero/null — pass through immediately
    if (!rules || (rules.cbsDelayMs === 0 && !rules.forceHttpError)) {
      return next();
    }

    // ── Forced HTTP error ──────────────────────────────────────────────────
    // Short-circuits the request entirely — response body mimics the real
    // error shape used by authController so frontend error handling is tested.
    if (rules.forceHttpError) {
      const statusCode = rules.forceHttpError;
      const errorMap = {
        500: 'ERR_CBS_INTERNAL_ERROR',
        503: 'ERR_CBS_UNAVAILABLE',
        429: 'ERR_CBS_RATE_LIMITED',
        408: 'ERR_CBS_TIMEOUT',
      };
      return res.status(statusCode).json({
        error: errorMap[statusCode] || 'ERR_CBS_CHAOS',
        message: `[CHAOS] Simulated ${statusCode} injected by sandbox`,
        chaos: true,
      });
    }

    // ── Latency injection ──────────────────────────────────────────────────
    // Delays next() by exactly cbsDelayMs to test frontend loading states
    // and timeout guardrails. Request completes normally after the delay.
    if (rules.cbsDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, rules.cbsDelayMs));
    }

    return next();
  };
}

export default chaosInterceptor;
