import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../backend/src/index.js';

describe('Agent Debug API Suite', () => {
  it('GET /api/debug/agents discovers all 6 watsonx Orchestrate agents', async () => {
    const res = await request(app).get('/api/debug/agents');
    expect(res.status).toBe(200);
    expect(res.body.totalDiscovered).toBe(6);
    expect(Array.isArray(res.body.agents)).toBe(true);
    expect(res.body.agents.length).toBe(6);

    const keys = res.body.agents.map((a) => a.key);
    expect(keys).toEqual(['orchestrator', 'localizer', 'faq', 'vision', 'watchdog', 'advisor']);

    // Check agent properties
    const orchestrator = res.body.agents.find((a) => a.key === 'orchestrator');
    expect(orchestrator.name).toBe('torii_master_orchestrator_agent');
    expect(orchestrator.model).toBe('watsonx/ibm/granite-3-8b-instruct');
    expect(orchestrator.tools).toContain('classify_customer_intent');
    expect(orchestrator.collaborators).toContain('torii_faq_agent');
  });

  it('GET /api/debug/supabase-data fetches accounts and transactions', async () => {
    const res = await request(app).get('/api/debug/supabase-data');
    expect(res.status).toBe(200);
    expect(res.body.totalAccounts).toBeGreaterThan(0);
    expect(Array.isArray(res.body.accounts)).toBe(true);

    const acc1 = res.body.accounts.find((a) => a.account_number === '1000000001');
    expect(acc1).toBeDefined();
    expect(acc1.full_name).toBe('ARJUN SHARMA');
    expect(acc1.hasFailedPanTx).toBe(true);
  });

  it('POST /api/debug/execute-agent rejects invalid agent key', async () => {
    const res = await request(app)
      .post('/api/debug/execute-agent')
      .send({ agentKey: 'non-existent-agent' });
    expect(res.status).toBe(404);
    expect(res.body.status).toBe('FAILURE');
  });
});
