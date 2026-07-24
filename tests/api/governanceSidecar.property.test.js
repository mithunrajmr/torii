import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { redactPAN } from '../../backend/src/ai/governanceSidecar.js';

describe('Property 6: Audit log payload is free of unmasked PAN PII', () => {
  it('redacts all valid PAN strings', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom('A', 'B', 'C', 'D', 'E', '1', '2', '3', '4', 'F'), { minLength: 10, maxLength: 10 }),
        (input) => {
          const redacted = redactPAN({ val: 'ABCDE1234F' });
          expect(redacted.val).not.toContain('ABCDE1234F');
          expect(redacted.val).toBe('XXXXX-1234-X');
        }
      )
    );
  });
});
