import { describe, it, expect, beforeEach } from 'vitest';

describe('Domain 1: Kiosk Proactive Triage Flow', () => {
  beforeEach(async () => {
    // 1. Use Global Factory Reset to wipe any dirty state from previous tests
    await fetch('http://localhost:3000/api/sandbox/reset', { method: 'DELETE' });
    
    // 2. Use Seed Specific Persona to prep the exact edge case needed
    await fetch('http://localhost:3000/api/sandbox/seed/PAN_BLOCKED', { method: 'POST' });
  });

  it('should intercept account 1000000001 and trigger PAN triage', async () => {
    // 3. Hit the real Kiosk Auth endpoint
    const response = await fetch('http://localhost:3000/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_number: '1000000001', otp: '123456' })
    });

    const data = await response.json();

    // 4. Assert the AI Orchestrator correctly caught the injected failure
    expect(response.status).toBe(200);
    expect(data.triage?.triageRequired).toBe(true);
    expect(data.triage?.errorCode).toBe('ERR_PAN_MISSING_OVER_50K');
  });

  it('should handle CBS database latency without crashing', async () => {
    // 5. Use Chaos Rules to inject 2 seconds of latency
    await fetch('http://localhost:3000/api/sandbox/chaos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cbsLatencyMs: 2000 })
    });

    const startTime = Date.now();
    await fetch('http://localhost:3000/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_number: '1000000001', otp: '123456' })
    });
    const duration = Date.now() - startTime;

    // Assert that the chaos rule delayed the response as expected
    expect(duration).toBeGreaterThanOrEqual(2000);
  });
});
