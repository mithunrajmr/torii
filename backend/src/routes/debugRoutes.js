// backend/src/routes/debugRoutes.js
// TORII Agent Debug & Validation Console API endpoints.
//
// ISOLATED DEBUG ENDPOINTS — strictly read-only for database operations.
// Allows testing every IBM watsonx Orchestrate agent independently.

import { Router } from 'express';
import { query } from '../db/index.js';

const router = Router();

const AGENT_SPECIFICATIONS = [
  {
    key: 'orchestrator',
    name: 'torii_master_orchestrator_agent',
    envVar: 'WXO_ORCHESTRATOR_AGENT_ID',
    defaultId: 'torii_master_orchestrator_agent',
    purpose: 'Master intent router for kiosk interactions. Classifies intent (PAN_MISSING, FAQ_QUERY, ACCOUNT_STATUS, GENERAL_TRIAGE) using customer input and account context.',
    model: 'watsonx/ibm/granite-3-8b-instruct',
    inputFormat: 'Text query + account_context JSON string',
    outputFormat: 'JSON object (intent, downstream, confidence, voice_response, show_qr, context_override)',
    callingMethod: 'intentRouter.js -> routeIntent()',
    tools: ['classify_customer_intent'],
    collaborators: ['torii_faq_agent', 'torii_localizer_agent'],
    defaultPrompt: 'Classify this customer intent: "I need to transfer 75000 rupees but it failed because PAN is missing."',
    defaultContext: { has_failed_pan_tx: true, recent_error_code: 'ERR_PAN_MISSING_OVER_50K' },
  },
  {
    key: 'localizer',
    name: 'torii_localizer_agent',
    envVar: 'WXO_LOCALIZER_AGENT_ID',
    defaultId: 'torii_localizer_agent',
    purpose: 'Multilingual language detection, PII redaction (PAN, Aadhaar, mobile, account), and translation (kiosk text -> clean English, English -> target language).',
    model: 'watsonx/ibm/granite-3-8b-instruct',
    inputFormat: 'Raw kiosk text / English text + target_language',
    outputFormat: 'Plain text string (clean English query or translated output)',
    callingMethod: 'intentRouter.js -> localizeInput() / translateResponse()',
    tools: ['process_kiosk_input', 'translate_response_to_language'],
    collaborators: [],
    defaultPrompt: 'Process this kiosk input through language detection and PII redaction:\nraw_text: "Mera account number 1000000001 hai aur PAN ABCDE1234F hai"\ndeclared_language: "auto"',
    defaultContext: {},
  },
  {
    key: 'faq',
    name: 'torii_faq_agent',
    envVar: 'WXO_FAQ_AGENT_ID',
    defaultId: 'torii_faq_agent',
    purpose: 'Answers general banking questions from a 40-entry structured policy knowledge base (KYC, limits, loans, FD/RD, cards, branch, cheques, NRI, schemes).',
    model: 'watsonx/ibm/granite-3-8b-instruct',
    inputFormat: 'Plain text English banking question',
    outputFormat: 'Plain text answer paraphrased from KB (or teller deflection hint)',
    callingMethod: 'faqAgent.js -> askFaqAgent()',
    tools: ['search_bank_faq', 'log_faq_query'],
    collaborators: [],
    defaultPrompt: 'What are the daily ATM withdrawal limits for savings accounts?',
    defaultContext: {},
  },
  {
    key: 'vision',
    name: 'torii_vision_ocr_agent',
    envVar: 'WXO_VISION_AGENT_ID',
    defaultId: 'torii-vision-ocr-agent',
    purpose: 'Extracts PAN card identity metadata (full name, 10-char PAN number, clarity score, confidence) using IBM Granite Vision model.',
    model: 'watsonx/ibm/granite-3-2-vision-11b-vision-instruct',
    inputFormat: 'Image base64 string + mime_type passed in context',
    outputFormat: 'JSON object (name, pan_number, clarity_score, confidence)',
    callingMethod: 'visionAgent.js -> processVisionOCR()',
    tools: ['extract_pan_from_image'],
    collaborators: [],
    defaultPrompt: 'You are a PAN card OCR extractor. Analyse the provided document image and extract identity details.',
    defaultContext: {},
  },
  {
    key: 'watchdog',
    name: 'torii_watchdog_aml_agent',
    envVar: 'WXO_WATCHDOG_AGENT_ID',
    defaultId: 'torii-watchdog-aml-agent',
    purpose: 'Analyses 48-hour transaction history for structuring patterns (splitting transfers to evade the ₹50,000 PAN threshold).',
    model: 'watsonx/ibm/granite-3-8b-instruct',
    inputFormat: 'Plain text prompt with JSON array of 48h transactions',
    outputFormat: 'JSON object (isSuspicious, reason, riskLevel, txCount48h, totalAmount48h)',
    callingMethod: 'swarmOrchestrator.js -> runWatchdogAgent()',
    tools: ['analyse_transaction_history'],
    collaborators: [],
    defaultPrompt: 'Analyse this transaction history for AML structuring risk:\n[{"amount": 49000, "created_at": "2026-07-27T04:00:00Z"}, {"amount": 48500, "created_at": "2026-07-26T18:00:00Z"}]',
    defaultContext: {},
  },
  {
    key: 'advisor',
    name: 'torii_advisor_agent',
    envVar: 'WXO_ADVISOR_AGENT_ID',
    defaultId: 'torii-advisor-agent',
    purpose: 'Generates a personalized financial product cross-sell offer (FD, LOAN, WEALTH, RD, INSURANCE) based on account balance tier.',
    model: 'watsonx/ibm/granite-3-8b-instruct',
    inputFormat: 'Plain text prompt with account_balance float and language',
    outputFormat: 'JSON object (title, offer, type)',
    callingMethod: 'swarmOrchestrator.js -> runAdvisorAgent()',
    tools: ['generate_cross_sell_offer'],
    collaborators: [],
    defaultPrompt: 'Generate a personalised cross-sell offer for a bank customer with account_balance=215000.0 and preferred_language="en".',
    defaultContext: {},
  },
];

// Helper: Get IAM Token for direct REST call payload verification
async function getIAMTokenForDebug() {
  const apiKey = process.env.WATSONX_ORCHESTRATE_API_KEY;
  if (!apiKey) throw new Error('WATSONX_ORCHESTRATE_API_KEY environment variable is not configured');

  const body = new URLSearchParams({
    grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
    apikey: apiKey,
  });

  const res = await fetch('https://iam.cloud.ibm.com/identity/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`IAM token authentication failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

/**
 * GET /api/debug/agents
 * Discovers all IBM watsonx Orchestrate agents and their status
 */
router.get('/agents', (req, res) => {
  const apiKeySet = Boolean(process.env.WATSONX_ORCHESTRATE_API_KEY);
  const endpointSet = Boolean(process.env.WATSONX_ORCHESTRATE_ENDPOINT);
  const endpoint = process.env.WATSONX_ORCHESTRATE_ENDPOINT || '';

  const discovered = AGENT_SPECIFICATIONS.map((spec) => {
    const configuredId = process.env[spec.envVar] || spec.defaultId;
    const isIdCustom = Boolean(process.env[spec.envVar]);

    return {
      ...spec,
      agentId: configuredId,
      isCustomId: isIdCustom,
      status: apiKeySet && endpointSet ? 'READY' : 'MISSING_CREDS',
    };
  });

  res.json({
    totalDiscovered: discovered.length,
    systemConfig: {
      apiKeyConfigured: apiKeySet,
      endpointConfigured: endpointSet,
      endpoint: endpoint,
    },
    agents: discovered,
  });
});

/**
 * GET /api/debug/supabase-data
 * Reads real accounts and transactions directly from Supabase (or mock fallback)
 * STRICTLY READ-ONLY FOR DEBUG INSPECTION
 */
router.get('/supabase-data', async (req, res) => {
  try {
    const accounts = await query`
      SELECT id, account_number, full_name, email, balance, pan_linked, pan_number, created_at
      FROM accounts
      ORDER BY account_number ASC
    `;

    // Fetch transactions for each account to form full Supabase payload context
    const accountsWithTxs = await Promise.all(
      accounts.map(async (acc) => {
        const txs = await query`
          SELECT id, account_id, amount, error_code, created_at
          FROM transactions
          WHERE account_id = ${acc.id}
          ORDER BY created_at DESC
        `;

        const failedTxs = txs.filter((t) => t.error_code !== null && t.error_code !== '');
        const hasFailedPan = txs.some(
          (t) =>
            t.error_code === 'ERR_PAN_MISSING_OVER_50K' &&
            new Date(t.created_at) >= new Date(Date.now() - 24 * 60 * 60 * 1000)
        );

        return {
          ...acc,
          balance: Number(acc.balance),
          transactions: txs.map((t) => ({ ...t, amount: Number(t.amount) })),
          failedTransactions: failedTxs.map((t) => ({ ...t, amount: Number(t.amount) })),
          hasFailedPanTx: hasFailedPan,
          recentErrorCode: failedTxs[0]?.error_code || null,
        };
      })
    );

    res.json({
      source: process.env.SUPABASE_DB_URL ? 'Supabase PostgreSQL' : 'Local Dev DB Mock',
      totalAccounts: accountsWithTxs.length,
      accounts: accountsWithTxs,
    });
  } catch (err) {
    console.warn('[debugRoutes] DB query failed, using mock fallback:', err.message);

    // Fallback seed accounts for dev/testing when DB is unreachable
    const mockAccounts = [
      {
        id: 'acc-0001-0000-0000-000000000001',
        account_number: '1000000001',
        full_name: 'ARJUN SHARMA',
        email: 'arjun.sharma@testbank.in',
        balance: 82500,
        pan_linked: false,
        pan_number: null,
        hasFailedPanTx: true,
        recentErrorCode: 'ERR_PAN_MISSING_OVER_50K',
        transactions: [
          { id: 'txn-1', amount: 75000, error_code: 'ERR_PAN_MISSING_OVER_50K', created_at: new Date().toISOString() }
        ],
        failedTransactions: [
          { id: 'txn-1', amount: 75000, error_code: 'ERR_PAN_MISSING_OVER_50K', created_at: new Date().toISOString() }
        ]
      },
      {
        id: 'acc-0002-0000-0000-000000000002',
        account_number: '1000000002',
        full_name: 'PRIYA NAIR',
        email: 'priya.nair@testbank.in',
        balance: 34200,
        pan_linked: true,
        pan_number: 'BCDFE5678G',
        hasFailedPanTx: false,
        recentErrorCode: null,
        transactions: [],
        failedTransactions: []
      },
      {
        id: 'acc-0003-0000-0000-000000000003',
        account_number: '1000000003',
        full_name: 'RAVI MEHTA',
        email: 'ravi.mehta@testbank.in',
        balance: 215000,
        pan_linked: false,
        pan_number: null,
        hasFailedPanTx: true,
        recentErrorCode: 'ERR_PAN_MISSING_OVER_50K',
        transactions: [
          { id: 'txn-31', amount: 49000, error_code: null, created_at: new Date().toISOString() },
          { id: 'txn-32', amount: 48500, error_code: null, created_at: new Date().toISOString() },
          { id: 'txn-33', amount: 55000, error_code: 'ERR_PAN_MISSING_OVER_50K', created_at: new Date().toISOString() }
        ],
        failedTransactions: [
          { id: 'txn-33', amount: 55000, error_code: 'ERR_PAN_MISSING_OVER_50K', created_at: new Date().toISOString() }
        ]
      }
    ];

    res.json({
      source: 'Local Dev DB Mock (DB Unreachable Fallback)',
      totalAccounts: mockAccounts.length,
      accounts: mockAccounts,
      warning: `PostgreSQL connection issue: ${err.message}`,
    });
  }
});

/**
 * POST /api/debug/execute-agent
 * Directly executes a single selected IBM watsonx Orchestrate agent.
 * Does NOT invoke the full orchestration pipeline.
 */
router.post('/execute-agent', async (req, res) => {
  const { agentKey, userMsg, context = {}, documentBase64, mimeType } = req.body;

  const spec = AGENT_SPECIFICATIONS.find((s) => s.key === agentKey);
  if (!spec) {
    return res.status(404).json({
      status: 'FAILURE',
      error: { message: `Unknown agent key: ${agentKey}`, missingFields: ['agentKey'] },
    });
  }

  const endpoint = process.env.WATSONX_ORCHESTRATE_ENDPOINT;
  const apiKey = process.env.WATSONX_ORCHESTRATE_API_KEY;
  const agentId = process.env[spec.envVar] || spec.defaultId;

  const missingEnvVars = [];
  if (!endpoint) missingEnvVars.push('WATSONX_ORCHESTRATE_ENDPOINT');
  if (!apiKey) missingEnvVars.push('WATSONX_ORCHESTRATE_API_KEY');
  if (!process.env[spec.envVar] && !spec.defaultId) missingEnvVars.push(spec.envVar);

  if (missingEnvVars.length > 0) {
    return res.status(400).json({
      status: 'CONFIGURATION_ERROR',
      agentKey,
      agentName: spec.name,
      agentId,
      error: {
        message: 'Required environment variables are missing',
        missingEnvVars,
        details: `Set the following environment variables in .env: ${missingEnvVars.join(', ')}`,
      },
    });
  }

  const promptText = userMsg || spec.defaultPrompt;
  const finalContext = { ...context };

  if (documentBase64) {
    finalContext.document_base64 = documentBase64;
    finalContext.mime_type = mimeType || 'image/jpeg';
  }

  const targetUrl = `${endpoint}/v1/orchestrate/${agentId}/chat/completions`;
  const requestPayload = {
    messages: [
      {
        role: 'user',
        content: promptText,
      },
    ],
    context: finalContext,
    stream: true,
  };

  const startTime = Date.now();
  let startTimeIso = new Date(startTime).toISOString();

  try {
    const token = await getIAMTokenForDebug();

    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const maskedHeaders = {
      Authorization: `Bearer ${token.slice(0, 10)}...[MASKED_LEN_${token.length}]`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestPayload),
      signal: AbortSignal.timeout(35000),
    });

    const endTime = Date.now();
    const latencyMs = endTime - startTime;

    const rawText = await response.text();

    let parsedResult = null;
    let parseError = null;

    if (response.ok) {
      try {
        // SSE parsing
        let assembled = '';
        if (rawText.trimStart().startsWith('{') || rawText.trimStart().startsWith('[')) {
          parsedResult = JSON.parse(rawText);
        } else {
          for (const line of rawText.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const payloadStr = trimmed.slice(5).trim();
            if (payloadStr === '[DONE]') break;
            try {
              const chunk = JSON.parse(payloadStr);
              const choice = chunk.choices?.[0];
              const piece = choice?.message?.content ?? choice?.delta?.content ?? '';
              if (piece) assembled += piece;
            } catch {
              // chunk parse warning
            }
          }
          const cleanedText = assembled.replace(/```(?:json)?\s*([\s\S]*?)```/i, '$1').trim();
          try {
            parsedResult = JSON.parse(cleanedText);
          } catch {
            parsedResult = cleanedText || assembled;
          }
        }
      } catch (err) {
        parseError = `Failed to parse agent output: ${err.message}`;
        parsedResult = rawText;
      }
    }

    res.json({
      status: response.ok ? 'SUCCESS' : 'FAILURE',
      agentKey,
      agentName: spec.name,
      agentId,
      httpStatus: response.status,
      timing: {
        startTime: startTimeIso,
        endTime: new Date(endTime).toISOString(),
        latencyMs,
      },
      request: {
        endpoint: targetUrl,
        headers: maskedHeaders,
        agentId,
        payload: requestPayload,
      },
      response: {
        raw: rawText,
        parsed: parsedResult,
        parseError,
      },
      error: response.ok
        ? null
        : {
            httpStatus: response.status,
            message: `IBM watsonx Orchestrate returned status ${response.status}`,
            rawResponseBody: rawText,
          },
    });
  } catch (err) {
    const endTime = Date.now();
    const latencyMs = endTime - startTime;

    res.status(500).json({
      status: 'FAILURE',
      agentKey,
      agentName: spec.name,
      agentId,
      httpStatus: 500,
      timing: {
        startTime: startTimeIso,
        endTime: new Date(endTime).toISOString(),
        latencyMs,
      },
      request: {
        endpoint: targetUrl,
        headers: { Authorization: 'Bearer [MASKED]', 'Content-Type': 'application/json' },
        agentId,
        payload: requestPayload,
      },
      error: {
        message: err.message,
        stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
        name: err.name,
      },
    });
  }
});

export default router;
