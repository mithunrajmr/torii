// backend/src/ai/swarmOrchestrator.js
// Parallel AI Agent Swarm Orchestrator.
//
// MANDATORY RULE: Vision OCR, Watchdog AML, and Advisor Cross-Sell agents MUST
// always be executed via Promise.all() — never sequentially.
//
// After Promise.all() resolves, execution telemetry is written fire-and-forget
// to agent_performance_log. PII is redacted before any snapshot is written.
//
// Env vars required per agent:
//   WXO_WATCHDOG_AGENT_ID  — Orchestrate agent ID for AML Watchdog
//   WXO_ADVISOR_AGENT_ID   — Orchestrate agent ID for Cross-Sell Advisor

import { processVisionOCR } from './visionAgent.js';
import { chatWithAgentJSON } from './orchestrateClient.js';
import { query } from '../db/index.js';
import { getAgentConfig } from '../services/configService.js';
import { redactPayload } from './governanceSidecar.js';
import { v4 as uuidv4 } from 'uuid';

const WATCHDOG_AGENT_ID = process.env.WXO_WATCHDOG_AGENT_ID || 'torii-watchdog-aml-agent';
const ADVISOR_AGENT_ID  = process.env.WXO_ADVISOR_AGENT_ID  || 'torii-advisor-agent';

// ─── Agent Performance Logging ────────────────────────────────────────────────

/**
 * Write a single row to agent_performance_log for one swarm agent.
 * Always fire-and-forget — never throws, never blocks the upload response.
 *
 * @param {object} opts
 * @param {string}  opts.agentName      'VISION_OCR' | 'WATCHDOG_AML' | 'ADVISOR'
 * @param {string}  opts.sessionId      SHA-256 derived session ID from the QR token
 * @param {string|null} opts.ticketId   Inserted ticket UUID (may be null pre-insert)
 * @param {number}  opts.execMs         Wall-clock execution time in milliseconds
 * @param {object}  opts.inputSummary   Minimal, PII-free input snapshot
 * @param {object}  opts.outputSummary  Minimal, PII-redacted output snapshot
 */
async function logAgentPerformance({ agentName, sessionId, ticketId, execMs, inputSummary, outputSummary }) {
  try {
    const safeOutput = redactPayload(outputSummary ?? {});
    const safeInput  = redactPayload(inputSummary  ?? {});

    await query`
      INSERT INTO agent_performance_log
        (agent_name, ticket_id, session_id, input_summary, output_summary, created_at)
      VALUES (
        ${agentName},
        ${ticketId ?? null},
        ${sessionId ?? null},
        ${JSON.stringify({ ...safeInput, exec_ms: execMs })},
        ${JSON.stringify(safeOutput)},
        NOW()
      )
    `;
  } catch (err) {
    // Non-fatal — never let telemetry failures affect the upload pipeline
    console.warn(`[swarmOrchestrator] Failed to log ${agentName} performance:`, err.message);
  }
}

// ─── Watchdog Agent ───────────────────────────────────────────────────────────

/**
 * AML structuring risk check.
 * Calls the watsonx Orchestrate Watchdog agent with recent transaction history.
 */
async function runWatchdogAgent(accountId) {
  const rows = await query`
    SELECT amount, created_at
    FROM transactions
    WHERE account_id = ${accountId}
      AND created_at >= NOW() - INTERVAL '48 hours'
  `;

  const txSummary = rows.map((r) => ({
    amount: Number(r.amount),
    created_at: r.created_at,
  }));

  const prompt =
    'Analyse this transaction history for AML structuring risk. ' +
    'Call the analyse_transaction_history tool with this transactions_json argument:\n' +
    JSON.stringify(txSummary) + '\n\n' +
    'Then return your risk assessment as a JSON object with exactly these keys: ' +
    '{"isSuspicious": boolean, "reason": string, "riskLevel": "LOW"|"MEDIUM"|"HIGH"|"CRITICAL", "txCount48h": number, "totalAmount48h": number}';

  const result = await chatWithAgentJSON(WATCHDOG_AGENT_ID, prompt, null);

  if (!result || typeof result.isSuspicious !== 'boolean') {
    console.warn('[WatchdogAgent] Orchestrate returned invalid response, defaulting to LOW risk.');
    return {
      isSuspicious:   false,
      reason:         'AML analysis unavailable — manual review recommended',
      riskLevel:      'LOW',
      txCount48h:     rows.length,
      totalAmount48h: rows.reduce((s, r) => s + Number(r.amount), 0),
    };
  }

  return {
    isSuspicious:   result.isSuspicious,
    reason:         result.reason     || 'Pattern analysis complete',
    riskLevel:      result.riskLevel  || 'LOW',
    txCount48h:     rows.length,
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

  const prompt =
    'Generate a personalised cross-sell offer for a bank customer. ' +
    `Call the generate_cross_sell_offer tool with account_balance=${balance} and preferred_language="en". ` +
    'Use the tool output to craft the offer, then return ONLY a JSON object: ' +
    '{"title": string (max 6 words), "offer": string (max 20 words, warm tone), "type": "FD"|"LOAN"|"INSURANCE"|"RD"|"WEALTH"}. ' +
    'No markdown, no explanation.';

  const result = await chatWithAgentJSON(ADVISOR_AGENT_ID, prompt, null);

  if (!result || !result.title || !result.offer) {
    console.warn('[AdvisorAgent] Orchestrate returned invalid response, using default offer.');
    const defaultOffers = {
      PREMIUM:  { title: 'Premium Wealth Management',    offer: 'Exclusive high-yield portfolio for premium members.',        type: 'WEALTH' },
      STANDARD: { title: '7.75% Fixed Deposit',          offer: 'Lock in guaranteed returns for 12 months, starting ₹10,000.', type: 'FD'    },
      ENTRY:    { title: 'Instant Pre-Approved Credit',  offer: 'Up to ₹1,00,000 credit disbursed in 24 hours.',              type: 'LOAN'   },
    };
    const tier = balance >= 500000 ? 'PREMIUM' : balance >= 50000 ? 'STANDARD' : 'ENTRY';
    return defaultOffers[tier];
  }

  return {
    title: String(result.title).slice(0, 60),
    offer: String(result.offer).slice(0, 120),
    type:  result.type || 'FD',
  };
}

// ─── Parallel Swarm Entry Point ───────────────────────────────────────────────

/**
 * Execute Vision OCR, Watchdog AML, and Advisor Cross-Sell concurrently.
 * This is the ONLY entry point for AI agent execution — always uses Promise.all().
 *
 * After resolution, fires performance telemetry to agent_performance_log
 * asynchronously. Call site (mobileController) passes sessionId and ticketId
 * after the ticket is inserted; the log rows are updated by tellerController
 * on teller action to close the feedback loop.
 *
 * @param {string}      accountId
 * @param {Buffer}      fileBuffer
 * @param {string}      mimeType
 * @param {object}      [opts]
 * @param {string}      [opts.sessionId]  SHA-256 derived session ID
 * @param {string|null} [opts.ticketId]   Ticket UUID (available after insert; can be backfilled)
 * @returns {Promise<{ocr: object, watchdog: object, advisor: object}>}
 */
export async function executeParallelSwarm(accountId, fileBuffer, mimeType, opts = {}) {
  const { sessionId = null, ticketId = null } = opts;

  // Load dynamic thresholds (cached 5 min)
  const visionCfg = await getAgentConfig('VISION_OCR');

  // Time each agent leg individually for telemetry
  const t0 = Date.now();

  const [
    [ocrResult,      ocrMs],
    [watchdogResult, watchdogMs],
    [advisorResult,  advisorMs],
  ] = await Promise.all([
    (async () => { const s = Date.now(); const r = await processVisionOCR(fileBuffer, mimeType); return [r, Date.now() - s]; })(),
    (async () => { const s = Date.now(); const r = await runWatchdogAgent(accountId);             return [r, Date.now() - s]; })(),
    (async () => { const s = Date.now(); const r = await runAdvisorAgent(accountId);              return [r, Date.now() - s]; })(),
  ]);

  // Fire-and-forget telemetry — runs after response is sent by mobileController
  Promise.all([
    logAgentPerformance({
      agentName:     'VISION_OCR',
      sessionId,
      ticketId,
      execMs:        ocrMs,
      inputSummary:  { image_size_kb: Math.round(fileBuffer.length / 1024), mime_type: mimeType },
      outputSummary: {
        id_type:       ocrResult.id_type,
        clarity_score: ocrResult.clarity_score,
        confidence:    ocrResult.confidence,
        pan_extracted: ocrResult.pan_number ? '[ID Redacted]' : null,
        tampering:     ocrResult.tampering_detected ?? false,
      },
    }),
    logAgentPerformance({
      agentName:     'WATCHDOG_AML',
      sessionId,
      ticketId,
      execMs:        watchdogMs,
      inputSummary:  { tx_count_48h: watchdogResult.txCount48h, total_amount: watchdogResult.totalAmount48h },
      outputSummary: {
        is_suspicious: watchdogResult.isSuspicious,
        risk_level:    watchdogResult.riskLevel,
        reason:        watchdogResult.reason,
      },
    }),
    logAgentPerformance({
      agentName:     'ADVISOR',
      sessionId,
      ticketId,
      execMs:        advisorMs,
      inputSummary:  { account_id: '[REDACTED]' },
      outputSummary: {
        offer_type:  advisorResult.type,
        offer_title: advisorResult.title,
      },
    }),
  ]).catch((err) => {
    console.warn('[swarmOrchestrator] Telemetry batch failed silently:', err.message);
  });

  return {
    ocr:      ocrResult,
    watchdog: watchdogResult,
    advisor:  advisorResult,
    _meta: {
      clarity_threshold:      visionCfg.clarity_threshold      ?? 0.80,
      name_match_hard_reject:  visionCfg.name_match_hard_reject ?? 0.50,
      name_match_soft_flag:    visionCfg.name_match_soft_flag   ?? 0.80,
    },
  };
}
