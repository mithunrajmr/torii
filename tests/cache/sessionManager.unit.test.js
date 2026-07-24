import { describe, it, expect, vi } from 'vitest';
import {
  setOTP,
  getOTP,
  deleteOTP,
  createKioskSession,
  getKioskSession,
  createQRToken,
  consumeQRToken,
} from '../../backend/src/cache/sessionManager.js';

vi.mock('../../backend/src/cache/redisClient.js', () => ({
  default: {
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockImplementation((key) => {
      if (key === 'otp:acc-123') return Promise.resolve('123456');
      if (key === 'session:jti-abc') return Promise.resolve('acc-123');
      if (key === 'qr:token-xyz') return Promise.resolve('acc-123');
      return Promise.resolve(null);
    }),
    del: vi.fn().mockResolvedValue(1),
    incrWithExpiry: vi.fn().mockResolvedValue(1),
  },
  set: vi.fn().mockResolvedValue('OK'),
  get: vi.fn().mockImplementation((key) => {
    if (key === 'otp:acc-123') return Promise.resolve('123456');
    if (key === 'session:jti-abc') return Promise.resolve('acc-123');
    if (key === 'qr:token-xyz') return Promise.resolve('acc-123');
    return Promise.resolve(null);
  }),
  del: vi.fn().mockResolvedValue(1),
  incrWithExpiry: vi.fn().mockResolvedValue(1),
}));

describe('Session Manager Cache Helper Suite', () => {
  it('sets and gets OTP from Redis', async () => {
    await setOTP('acc-123', '123456');
    const otp = await getOTP('acc-123');
    expect(otp).toBe('123456');
  });

  it('creates and consumes QR tokens', async () => {
    await createQRToken('token-xyz', 'acc-123');
    const accountId = await consumeQRToken('token-xyz');
    expect(accountId).toBe('acc-123');
  });
});
