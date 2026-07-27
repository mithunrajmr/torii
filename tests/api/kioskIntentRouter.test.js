// tests/api/kioskIntentRouter.test.js
import { describe, it, expect } from 'vitest';
import { processKioskQuery } from '../../backend/src/ai/intentRouter.js';

describe('Phase 5 — Kiosk Intent Router Multi-Service Classification', () => {
  it('routes Full KYC query correctly', async () => {
    const res = await processKioskQuery('I want to complete my full CKYC verification');
    expect(res.routing.intent).toBe('FULL_KYC');
    expect(res.routing.serviceType).toBe('FULL_KYC');
    expect(res.routing.showQR).toBe(true);
  });

  it('routes Address Change query correctly', async () => {
    const res = await processKioskQuery('I moved to a new flat and need to update my address');
    expect(res.routing.intent).toBe('ADDRESS_CHANGE');
    expect(res.routing.serviceType).toBe('ADDRESS_CHANGE');
    expect(res.routing.showQR).toBe(true);
  });

  it('routes Nominee query correctly', async () => {
    const res = await processKioskQuery('How do I add a nominee to my bank account?');
    expect(res.routing.intent).toBe('NOMINEE_UPDATE');
    expect(res.routing.serviceType).toBe('NOMINEE_UPDATE');
    expect(res.routing.showQR).toBe(true);
  });

  it('routes Aadhaar query correctly', async () => {
    const res = await processKioskQuery('Link my Aadhaar card for NPCI direct benefit transfer');
    expect(res.routing.intent).toBe('AADHAAR_LINK');
    expect(res.routing.serviceType).toBe('AADHAAR_LINK');
    expect(res.routing.showQR).toBe(true);
  });

  it('routes Account Upgrade and Debit Card query correctly', async () => {
    const res = await processKioskQuery('Request new debit card and chequebook delivery');
    expect(res.routing.intent).toBe('ACCOUNT_UPGRADE');
    expect(res.routing.serviceType).toBe('ACCOUNT_UPGRADE');
    expect(res.routing.showQR).toBe(true);
  });

  it('routes High Value Clearance query correctly', async () => {
    const res = await processKioskQuery('High value transaction pre-clearance with invoice');
    expect(res.routing.intent).toBe('HIGH_VALUE_CLEARANCE');
    expect(res.routing.serviceType).toBe('HIGH_VALUE_CLEARANCE');
    expect(res.routing.showQR).toBe(true);
  });
});
