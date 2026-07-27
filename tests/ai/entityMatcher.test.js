// tests/ai/entityMatcher.test.js
import { describe, it, expect } from 'vitest';
import { matchNames, normalizeDate, evaluateEntityMatch } from '../../backend/src/ai/entityMatcherAgent.js';

describe('Phase 2 — Entity Matcher Agent', () => {
  it('computes exact name match score as 1.0', () => {
    expect(matchNames('Arjun Sharma', 'ARJUN SHARMA')).toBe(1.0);
  });

  it('handles token order variations with high match score', () => {
    const score = matchNames('Sharma Arjun', 'ARJUN SHARMA');
    expect(score).toBeGreaterThanOrEqual(0.70);
  });

  it('flags major name mismatches (< 0.50)', () => {
    const score = matchNames('Priya Nair', 'ARJUN SHARMA');
    expect(score).toBeLessThan(0.50);
  });

  it('normalizes date strings to YYYY-MM-DD format', () => {
    expect(normalizeDate('16/07/1986')).toBe('1986-07-16');
    expect(normalizeDate('1986-07-16')).toBe('1986-07-16');
    expect(normalizeDate('16-07-1986')).toBe('1986-07-16');
  });

  it('evaluates multi-document entity package and detects mismatches', () => {
    const result = evaluateEntityMatch({
      registeredName: 'ARJUN SHARMA',
      registeredDob: '1986-07-16',
      documents: [
        { id_type: 'PAN', name: 'ARJUN SHARMA', dob: '16/07/1986' },
        { id_type: 'Aadhaar', name: 'ARJUN SHARMA', dob: '16/07/1986' },
      ],
    });

    expect(result.isMatch).toBe(true);
    expect(result.overallScore).toBe(1.0);
    expect(result.mismatchFlags).toHaveLength(0);
  });

  it('captures mismatch flags when name or DOB differs', () => {
    const result = evaluateEntityMatch({
      registeredName: 'ARJUN SHARMA',
      registeredDob: '1986-07-16',
      documents: [
        { id_type: 'PAN', name: 'PRIYA NAIR', dob: '1990-01-01' },
      ],
    });

    expect(result.isMatch).toBe(false);
    expect(result.mismatchFlags.length).toBeGreaterThan(0);
  });
});
