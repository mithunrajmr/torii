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
  try {
    const rows = await query`
      SELECT amount, created_at
      FROM transactions
      WHERE account_id = ${accountId}
        AND created_at >= NOW() - INTERVAL '48 hours'
    `;

    // If Orchestrate is available, let the agent reason about the data
    if (process.env.WATSONX_ORCHESTRATE_API_KEY && process.env.WATSONX_ORCHESTRATE_ENDPOINT) {
      const txSummary = rows.map((r) => ({
        amount: Number(r.amount),
        created_at: r.created_at,
      }));

      const prompt =
        'You are an AML compliance watchdog for an Indian retail bank. ' +
        'Analyse the following transaction history (last 48 hours) and determine if there is a ' +
        'structuring risk (splitting large amounts to avoid reporting thresholds). ' +
        'Return ONLY a JSON object: ' +
        '{"isSuspicious": boolean, "reason": string, "txCount48h": number, "totalAmount48h": number}.\n\n' +
        `Transaction history: ${JSON.stringify(txSummary)}`;

      const fallback = _watchdogHeuristic(rows);
      const result = await chatWithAgentJSON(WATCHDOG_AGENT_ID, prompt, fallback);
      return {
        isSuspicious: Boolean(result.isSuspicious),
        reason: result.reason || 'Pattern analysis complete',
        txCount48h: rows.length,
        totalAmount48h: rows.reduce((s, r) => s + Number(r.amount), 0),
      };
    }

    // Dev fallback — heuristic only
    return _watchdogHeuristic(rows);
  } catch (err) {
    console.warn('[WatchdogAgent] Degraded to safe default:', err.message);
    return { isSuspicious: false, reason: 'Analysis unavailable', txCount48h: 0, totalAmount48h: 0 };
  }
}

function _watchdogHeuristic(rows) {
  const totalAmount = rows.reduce((sum, r) => sum + Number(r.amount), 0);
  const isSuspicious = rows.length >= 3 || totalAmount > 200000;
  return {
    isSuspicious,
    reason: isSuspicious ? 'High transaction volume / structuring pattern detected' : 'No suspicious pattern',
    txCount48h: rows.length,
    totalAmount48h: totalAmount,
  };
}

// ─── Advisor Agent ────────────────────────────────────────────────────────────

/**
 * Personalized cross-sell offer generator.
 * Calls the watsonx Orchestrate Advisor agent with the customer's balance profile.
 */
async function runAdvisorAgent(accountId) {
  try {
    const rows = await query`
      SELECT balance FROM accounts WHERE id = ${accountId} LIMIT 1
    `;
    const balance = rows.length ? Number(rows[0].balance) : 10000;

    if (process.env.WATSONX_ORCHESTRATE_API_KEY && process.env.WATSONX_ORCHESTRATE_ENDPOINT) {
      const prompt =
        'You are a financial advisor for an Indian retail bank. ' +
        'Generate a personalised, compelling cross-sell offer for a customer. ' +
        `Their current account balance is ₹${balance.toLocaleString('en-IN')}. ` +
        'Return ONLY a JSON object: {"title": string, "offer": string, "type": "FD"|"LOAN"|"INSURANCE"}. ' +
        'Keep the offer concise (under 20 words) and relevant to their balance tier.';

      const fallback = _advisorFallback(balance);
      return await chatWithAgentJSON(ADVISOR_AGENT_ID, prompt, fallback);
    }

    return _advisorFallback(balance);
  } catch (err) {
    return { title: 'Fixed Deposit Growth Plan', offer: 'Grow your savings with 7.50% p.a. fixed returns.', type: 'FD' };
  }
}

function _advisorFallback(balance) {
  if (balance > 50000) {
    return { title: 'High-Yield Fixed Deposit Special', offer: 'Lock in 7.75% p.a. on 12-month tenure today.', type: 'FD' };
  }
  return { title: 'Pre-Approved Instant Credit Line', offer: 'Pre-approved for ₹1,00,000 with zero documentation.', type: 'LOAN' };
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
