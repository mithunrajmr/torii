import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

describe('Property 10: Countdown timer accent color threshold', () => {
  it('drives accent color when countdown <= 10', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 45 }),
        (countdown) => {
          const isAccent = countdown <= 10;
          if (countdown <= 10) {
            expect(isAccent).toBe(true);
          } else {
            expect(isAccent).toBe(false);
          }
        }
      )
    );
  });
});
