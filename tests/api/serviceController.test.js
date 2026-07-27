// tests/api/serviceController.test.js
import { describe, it, expect } from 'vitest';
import { SERVICE_REGISTRY } from '../../backend/src/config/serviceSchemas.js';

describe('Phase 1 — Service Schemas & Registry', () => {
  it('contains all 7 core branch operational services', () => {
    const expectedServices = [
      'FULL_KYC',
      'AADHAAR_LINK',
      'PAN_LINK',
      'ADDRESS_CHANGE',
      'NOMINEE_UPDATE',
      'ACCOUNT_UPGRADE',
      'HIGH_VALUE_CLEARANCE',
    ];

    expectedServices.forEach((serviceType) => {
      expect(SERVICE_REGISTRY).toHaveProperty(serviceType);
      const schema = SERVICE_REGISTRY[serviceType];
      expect(schema.title).toBeDefined();
      expect(schema.documentSlots).toBeInstanceOf(Array);
      expect(schema.formFields).toBeInstanceOf(Array);
    });
  });

  it('supports digital signature canvas requirement on relevant forms', () => {
    expect(SERVICE_REGISTRY.FULL_KYC.requiresSignature).toBe(true);
    expect(SERVICE_REGISTRY.ADDRESS_CHANGE.requiresSignature).toBe(true);
    expect(SERVICE_REGISTRY.NOMINEE_UPDATE.requiresSignature).toBe(true);
    expect(SERVICE_REGISTRY.AADHAAR_LINK.requiresSignature).toBe(true);
    expect(SERVICE_REGISTRY.ACCOUNT_UPGRADE.requiresSignature).toBe(true);
    expect(SERVICE_REGISTRY.HIGH_VALUE_CLEARANCE.requiresSignature).toBe(true);
  });
});
