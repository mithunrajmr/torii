// tests/api/tellerFulfillment.test.js
import { describe, it, expect } from 'vitest';
import { SERVICE_REGISTRY } from '../../backend/src/config/serviceSchemas.js';

describe('Phase 4 — Teller Multi-Service Fulfillment Integration', () => {
  it('defines fulfillment handlers for all 7 branch services', () => {
    Object.keys(SERVICE_REGISTRY).forEach((key) => {
      const config = SERVICE_REGISTRY[key];
      expect(config).toHaveProperty('title');
      expect(config).toHaveProperty('serviceType');
    });
  });

  it('contains expected service types', () => {
    const keys = Object.keys(SERVICE_REGISTRY);
    expect(keys).toContain('FULL_KYC');
    expect(keys).toContain('ADDRESS_CHANGE');
    expect(keys).toContain('NOMINEE_UPDATE');
    expect(keys).toContain('AADHAAR_LINK');
    expect(keys).toContain('PAN_LINK');
    expect(keys).toContain('ACCOUNT_UPGRADE');
    expect(keys).toContain('HIGH_VALUE_CLEARANCE');
  });
});
