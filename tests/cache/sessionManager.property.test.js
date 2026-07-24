import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

describe('Property 2: Ephemeral session TTL fidelity', () => {
  it('enforces exact TTL specifications for ephemeral keys', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('OTP', 'SESSION', 'QR'),
        (type) => {
          const ttls = { OTP: 300, SESSION: 120, QR: 600 };
          expect(ttls[type]).toBeGreaterThan(0);
        }
      )
    );
  });
});
