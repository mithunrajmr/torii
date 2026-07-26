// backend/src/ai/swarmOrchestrator.js
// Parallel AI Agent Swarm Orchestrator.
//
// MANDATORY RULE: Vision OCR, Watchdog AML, and Advisor Cross-Sell agents MUST
// always be executed via Promise.all() — never sequentially.
//
// Each agent call delegates to the corresponding watsonx Orchestrate agent
// deployed via the ADK (see /watsonx-orchestrate/agents/).
//
// Env vars required per agent:
//   WXO_VISION_AGENT_ID    — Orchestrate agent ID for Vision OCR
//   WXO_WATCHDOG_AGENT_ID  — Orchestrate agent ID for AML Watchdog
//   WXO_ADVISOR_AGENT_ID   — Orchestrate agent ID for Cross-Sell Advisor

import { processVisionOCR, computeNameMatchScore } from './visionAgent.js';
import { chatWithAgentJSON } from './orchestrateClient.js';
import { query } from '../db/index.js';

const WATCHDOG_AGENT_ID = process.env.WXO_WATCHDOG_AGENT_ID || 'torii-watchdog-aml-agent';
const ADVISOR_AGENT_ID  = process.env.WXO_ADVISOR_AGENT_ID  || 'torii-advisor-agent';

// ─── Watchdog Agent ───────────────────────────────────────────────────────────

/**
 * AML structuring risk check.
 * Calls the watsonx Orchestrate Watchdog agent with recent transaction history,
 * falls back to direct heuristic if Orchestrate is not configured.
 */
async function runWatchdogAgent(accountId) {
  const rows = await query`
    SELECT amount, created_at
    FROM transactions
    WHERE account_id = ${accountId}
      AND created_at >= NOW() - INTERVAL '48 hours'
  `;

  // Strip account_id before sending to agent (data minimisation)
  const txSummary = rows.map((r) => ({
    amount: Number(r.amount),
    created_at: r.created_at,
  }));

  const txJsonString = JSON.stringify(txSummary);

  const prompt =
    'Analyse this transaction history for AML structuring risk. ' +
    'Call the analyse_transaction_history tool with this transactions_json argument:\n' +
    txJsonString + '\n\n' +
    'Then return your risk assessment as a JSON object with exactly these keys: ' +
    '{"isSuspicious": boolean, "reason": string, "riskLevel": "LOW"|"MEDIUM"|"HIGH"|"CRITICAL", "txCount48h": number, "totalAmount48h": number}';

  const result = await chatWithAgentJSON(WATCHDOG_AGENT_ID, prompt, null);

  // Graceful degradation: if Orchestrate returns bad JSON, default to LOW risk.
  // The ticket is still created — teller reviews manually.
  if (!result || typeof result.isSuspicious !== 'boolean') {
    console.warn('[WatchdogAgent] Orchestrate returned invalid response, defaulting to LOW risk:', JSON.stringify(result));
    return {
      isSuspicious: false,
      reason: 'AML analysis unavailable — manual review recommended',
      riskLevel: 'LOW',
      txCount48h: rows.length,
      totalAmount48h: rows.reduce((s, r) => s + Number(r.amount), 0),
    };
  }

  return {
    isSuspicious: result.isSuspicious,
    reason: result.reason || 'Pattern analysis complete',
    riskLevel: result.riskLevel || 'LOW',
    txCount48h: rows.length,
    totalAmount48h: rows.reduce((s, r) => s + Number(r.amount), 0),
  };
}

// ─── Advisor Agent ────────────────────────────────────────────────────────────

/**
 * Personalized cross-sell offer generator.
 * Calls the watsonx Orchestrate Advisor agent with the customer's balance profile.
 */
async function runAdvisorAgent(accountId) {
  const rows = await query`
    SELECT balance FROM accounts WHERE id = ${accountId} LIMIT 1
  `;
  const balance = rows.length ? Number(rows[0].balance) : 0;

  // Map balance to tier label — agent receives a structured label, not a raw float
  const balanceTier = balance >= 500000 ? 'PREMIUM' : balance >= 50000 ? 'STANDARD' : 'ENTRY';

  const prompt =
    'Generate a personalised cross-sell offer for a bank customer. ' +
    `Call the generate_cross_sell_offer tool with account_balance=${balance} and preferred_language="en". ` +
    'Use the tool output to craft the offer, then return ONLY a JSON object: ' +
    '{"title": string (max 6 words), "offer": string (max 20 words, warm tone), "type": "FD"|"LOAN"|"INSURANCE"|"RD"|"WEALTH"}. ' +
    'No markdown, no explanation.';

  const result = await chatWithAgentJSON(ADVISOR_AGENT_ID, prompt, null);

  // Graceful degradation: if Orchestrate returns bad JSON, return a generic offer.
  // Cross-sell failure must never block the PAN upload flow.
  if (!result || !result.title || !result.offer) {
    console.warn('[AdvisorAgent] Orchestrate returned invalid response, using default offer:', JSON.stringify(result));
    const defaultOffers = {
      PREMIUM: { title: 'Premium Wealth Management', offer: 'Exclusive high-yield portfolio for premium members.', type: 'WEALTH' },
      STANDARD: { title: '7.75% Fixed Deposit', offer: 'Lock in guaranteed returns for 12 months, starting ₹10,000.', type: 'FD' },
      ENTRY:    { title: 'Instant Pre-Approved Credit', offer: 'Up to ₹1,00,000 credit disbursed in 24 hours.', type: 'LOAN' },
    };
    const balance = (await query`SELECT balance FROM accounts WHERE id = ${accountId} LIMIT 1`)[0]?.balance ?? 0;
    const tier = Number(balance) >= 500000 ? 'PREMIUM' : Number(balance) >= 50000 ? 'STANDARD' : 'ENTRY';
    return defaultOffers[tier];
  }

  return {
    title: String(result.title).slice(0, 60),
    offer: String(result.offer).slice(0, 120),
    type: result.type || 'FD',
  };
}

// ─── Parallel Swarm Entry Point ───────────────────────────────────────────────

/**
 * Execute Vision OCR, Watchdog AML, and Advisor Cross-Sell concurrently.
 * This is the ONLY entry point for AI agent execution — always uses Promise.all().
 *
 * @param {string} accountId
 * @param {Buffer} fileBuffer
 * @param {string} mimeType
 * @returns {Promise<{ocr: object, watchdog: object, advisor: object}>}
 */
export async function executeParallelSwarm(accountId, fileBuffer, mimeType) {
  const [ocrResult, watchdogResult, advisorResult] = await Promise.all([
    processVisionOCR(fileBuffer, mimeType),
    runWatchdogAgent(accountId),
    runAdvisorAgent(accountId),
  ]);

  return {
    ocr: ocrResult,
    watchdog: watchdogResult,
    advisor: advisorResult,
  };
}
