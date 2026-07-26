import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../../backend/src/index.js';

describe('Auth API Controller Suite', () => {
  it('GET /api/health returns TORII system info', async () => {
    const res = await request(app).get('/api/health');
    // In test env, DB/Redis probes may fail (mock creds) — accept 200 or 503
    expect([200, 503]).toContain(res.status);
    expect(['OK', 'DEGRADED']).toContain(res.body.status);
    expect(res.body.system).toContain('TORII');
    expect(res.body.checks).toBeDefined();
    expect(res.body.env).toBeDefined();
  });

  it('POST /api/auth/otp/request validates 10-digit account number', async () => {
    const res = await request(app)
      .post('/api/auth/otp/request')
      .send({ account_number: '123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('ERR_INVALID_ACCOUNT_NUMBER');
  });
});
