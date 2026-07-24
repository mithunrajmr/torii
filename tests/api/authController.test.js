import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../../backend/src/index.js';

describe('Auth API Controller Suite', () => {
  it('GET /api/health returns 200 OK', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
    expect(res.body.system).toContain('TORII');
  });

  it('POST /api/auth/otp/request validates 10-digit account number', async () => {
    const res = await request(app)
      .post('/api/auth/otp/request')
      .send({ account_number: '123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('ERR_INVALID_ACCOUNT_NUMBER');
  });
});
