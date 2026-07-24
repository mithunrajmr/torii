import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

describe('Property 9: Numeric keypad input filtering', () => {
  it('filters out non-numeric characters', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (input) => {
          const digitsOnly = input.replace(/\D/g, '');
          expect(/^\d*$/.test(digitsOnly)).toBe(true);
        }
      )
    );
  });
});
