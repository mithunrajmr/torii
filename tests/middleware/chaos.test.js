// tests/middleware/chaos.test.js
// Unit tests for the chaos interceptor middleware.
//
// Verifies:
//   - No delay when no chaos rules are set.
//   - Artificial latency is injected when cbsDelayMs > 0.
//   - Forced HTTP error short-circuits the request.
//   - Rules are read from Redis (mocked).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock Redis ─────────────────────────────────────────────────────────────
let mockRedisValue = null;

vi.mock('../../backend/src/cache/redisClient.js', () => ({
  get: vi.fn(async () => mockRedisValue),
  set: vi.fn(async () => 'OK'),
  del: vi.fn(async () => 1),
  default: {},
}));

import { chaosInterceptor, clearChaosCache } from '../../backend/src/middleware/chaosInterceptor.js';

// ── Test helpers ──────────────────────────────────────────────────────────
function buildMockReqRes() {
  const req = {};
  const res = {
    _status: null,
    _json: null,
    status(code) { this._status = code; return this; },
    json(body) { this._json = body; return this; },
  };
  const next = vi.fn();
  return { req, res, next };
}

describe('chaosInterceptor', () => {
  beforeEach(() => {
    clearChaosCache();
    vi.clearAllMocks();
    mockRedisValue = null;
  });

  // ── Pass-through when no rules ────────────────────────────────────────────
  it('calls next() immediately when no chaos rules are set', async () => {
    mockRedisValue = null;
    const { req, res, next } = buildMockReqRes();
    const middleware = chaosInterceptor();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res._status).toBeNull();
  });

  it('calls next() immediately when cbsDelayMs = 0 and no forceHttpError', async () => {
    mockRedisValue = JSON.stringify({ cbsDelayMs: 0, forceHttpError: null });
    clearChaosCache();
    const { req, res, next } = buildMockReqRes();

    await chaosInterceptor()(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res._status).toBeNull();
  });

  // ── Latency injection ─────────────────────────────────────────────────────
  it('delays next() call by approximately cbsDelayMs', async () => {
    mockRedisValue = JSON.stringify({ cbsDelayMs: 100, forceHttpError: null });
    clearChaosCache();
    const { req, res, next } = buildMockReqRes();

    const start = Date.now();
    await chaosInterceptor()(req, res, next);
    const elapsed = Date.now() - start;

    expect(next).toHaveBeenCalledOnce();
    // Allow 20ms variance for test runner overhead
    expect(elapsed).toBeGreaterThanOrEqual(80);
  });

  it('still calls next() after delay (request completes normally)', async () => {
    mockRedisValue = JSON.stringify({ cbsDelayMs: 50, forceHttpError: null });
    clearChaosCache();
    const { req, res, next } = buildMockReqRes();

    await chaosInterceptor()(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res._status).toBeNull(); // no error response was sent
  });

  // ── Forced HTTP errors ────────────────────────────────────────────────────
  it('returns 503 and does NOT call next() when forceHttpError = 503', async () => {
    mockRedisValue = JSON.stringify({ cbsDelayMs: 0, forceHttpError: 503 });
    clearChaosCache();
    const { req, res, next } = buildMockReqRes();

    await chaosInterceptor()(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(503);
    expect(res._json.chaos).toBe(true);
    expect(res._json.error).toBe('ERR_CBS_UNAVAILABLE');
  });

  it('returns 500 with ERR_CBS_INTERNAL_ERROR for forceHttpError = 500', async () => {
    mockRedisValue = JSON.stringify({ cbsDelayMs: 0, forceHttpError: 500 });
    clearChaosCache();
    const { req, res, next } = buildMockReqRes();

    await chaosInterceptor()(req, res, next);

    expect(res._status).toBe(500);
    expect(res._json.error).toBe('ERR_CBS_INTERNAL_ERROR');
  });

  it('returns 429 with ERR_CBS_RATE_LIMITED for forceHttpError = 429', async () => {
    mockRedisValue = JSON.stringify({ cbsDelayMs: 0, forceHttpError: 429 });
    clearChaosCache();
    const { req, res, next } = buildMockReqRes();

    await chaosInterceptor()(req, res, next);

    expect(res._status).toBe(429);
    expect(res._json.error).toBe('ERR_CBS_RATE_LIMITED');
  });

  it('returns 408 with ERR_CBS_TIMEOUT for forceHttpError = 408', async () => {
    mockRedisValue = JSON.stringify({ cbsDelayMs: 0, forceHttpError: 408 });
    clearChaosCache();
    const { req, res, next } = buildMockReqRes();

    await chaosInterceptor()(req, res, next);

    expect(res._status).toBe(408);
    expect(res._json.error).toBe('ERR_CBS_TIMEOUT');
  });

  // ── Forced error takes priority over delay ────────────────────────────────
  it('short-circuits immediately when forceHttpError is set even with delay', async () => {
    mockRedisValue = JSON.stringify({ cbsDelayMs: 5000, forceHttpError: 503 });
    clearChaosCache();
    const { req, res, next } = buildMockReqRes();

    const start = Date.now();
    await chaosInterceptor()(req, res, next);
    const elapsed = Date.now() - start;

    // Should NOT wait the 5000ms delay — forceHttpError comes first
    expect(elapsed).toBeLessThan(500);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(503);
  });

  // ── Redis failure resilience ───────────────────────────────────────────────
  it('fails open (calls next) when Redis throws', async () => {
    const { get } = await import('../../backend/src/cache/redisClient.js');
    get.mockRejectedValueOnce(new Error('Redis connection refused'));
    clearChaosCache();
    const { req, res, next } = buildMockReqRes();

    await chaosInterceptor()(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  // ── In-process cache ──────────────────────────────────────────────────────
  it('reads Redis only once per cache TTL window', async () => {
    mockRedisValue = JSON.stringify({ cbsDelayMs: 0, forceHttpError: null });
    clearChaosCache();
    const { get } = await import('../../backend/src/cache/redisClient.js');

    const middleware = chaosInterceptor();
    const { req: r1, res: rs1, next: n1 } = buildMockReqRes();
    const { req: r2, res: rs2, next: n2 } = buildMockReqRes();

    await middleware(r1, rs1, n1);
    await middleware(r2, rs2, n2);

    // Second call should use cache — get called only once
    expect(get).toHaveBeenCalledOnce();
  });
});
