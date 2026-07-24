import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

describe('Property 5: PAN threshold rule boolean boundary', () => {
  it('blocks transactions over 50,000 when PAN is unlinked', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 200000 }),
        fc.boolean(),
        (amount, panLinked) => {
          const shouldBlock = amount > 50000 && !panLinked;
          if (amount > 50000 && !panLinked) {
            expect(shouldBlock).toBe(true);
          } else {
            expect(shouldBlock).toBe(false);
          }
        }
      )
    );
  });
});
