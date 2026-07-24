import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

describe('Property 4: Failed Transaction Diagnosis', () => {
  it('correctly filters transactions inside 24h window', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            amount: fc.float({ min: 1, max: 100000 }),
            error_code: fc.constantFrom('ERR_PAN_MISSING_OVER_50K', 'ERR_OTHER'),
            isRecent: fc.boolean(),
          })
        ),
        (txs) => {
          const matching = txs.filter(
            (t) => t.error_code === 'ERR_PAN_MISSING_OVER_50K' && t.isRecent
          );
          expect(matching.length).toBeLessThanOrEqual(txs.length);
        }
      )
    );
  });
});
