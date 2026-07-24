import { describe, it, expect } from 'vitest';
import { redactPAN, redactAccountNumber } from '../../backend/src/ai/governanceSidecar.js';

describe('Governance Sidecar PII Redaction', () => {
  it('masks PAN numbers (ABCDE1234F) to XXXXX-1234-X in payload', () => {
    const payload = {
      user: 'Test User',
      pan: 'ABCDE1234F',
      nested: { pan: 'XYZAB9876Q' },
    };

    const redacted = redactPAN(payload);
    expect(redacted.pan).toBe('XXXXX-1234-X');
    expect(redacted.nested.pan).toBe('XXXXX-1234-X');
  });

  it('masks 10-digit account numbers to last 4 digits', () => {
    const payload = {
      account_number: '1234567890',
    };

    const redacted = redactAccountNumber(payload);
    expect(redacted.account_number).toBe('****7890');
  });
});
