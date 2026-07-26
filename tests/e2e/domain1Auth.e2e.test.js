import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../backend/src/index.js';

describe('Domain 1 End-to-End Flow Test', () => {
  it('health endpoint returns system status', async () => {
    const res = await request(app).get('/api/health');
    // In test env DB/Redis probes may fail — accept 200 or 503
    expect([200, 503]).toContain(res.status);
    expect(['OK', 'DEGRADED']).toContain(res.body.status);
    expect(res.body.system).toContain('TORII');
  });

  it('rejects invalid OTP requests', async () => {
    const res = await request(app)
      .post('/api/auth/otp/request')
      .send({ account_number: 'abc' });
    expect(res.status).toBe(400);
  });
});
