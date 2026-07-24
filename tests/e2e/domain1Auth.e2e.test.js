import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../backend/src/index.js';

describe('Domain 1 End-to-End Flow Test', () => {
  it('health endpoint returns system status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });

  it('rejects invalid OTP requests', async () => {
    const res = await request(app)
      .post('/api/auth/otp/request')
      .send({ account_number: 'abc' });
    expect(res.status).toBe(400);
  });
});
