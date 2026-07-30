// backend/src/controllers/kioskController.js
// Handles the kiosk voice/text query pipeline:
//   1. Validate customer JWT (already verified by middleware)
//   2. Fetch account context (recent failed transactions)
//   3. Run the Localizer → Orchestrator pipeline
//   4. If intent is FAQ_QUERY, call FAQ agent for the answer
//   5. Log every FAQ query to faq_query_log for KB gap analysis
//   6. Return routing decision + TTS voice response to the kiosk UI
//
// POST /api/kiosk/query
//   Body: { query: string, language?: string }
//   Auth: Bearer <kiosk JWT>
//
// Response:
//   {
//     intent: "PAN_MISSING" | "FAQ_QUERY" | "ACCOUNT_STATUS" | "GENERAL_TRIAGE",
//     downstream: string,
//     voiceResponse: string,   // TTS-ready sentence
//     showQR: boolean,
//     faqAnswer?: string,      // present only when intent === "FAQ_QUERY"
//     confidence: number,
//     detectedLanguage: string
//   }

import { processKioskQuery } from '../ai/intentRouter.js';
import { askFaqAgent } from '../ai/faqAgent.js';
import { emitAuthEvent, AuditEventType } from '../ai/governanceSidecar.js';
import { query } from '../db/index.js';

/**
 * Check the account's recent transaction ledger for known failure codes.
 * Returns context flags used by the Orchestrator for intent classification.
 */
async function fetchAccountContext(accountId) {
  try {
    const rows = await query`
      SELECT error_code, created_at
      FROM transactions
      WHERE account_id = ${accountId}
        AND created_at >= NOW() - INTERVAL '24 hours'
        AND error_code IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 5
    `;

    const panMissingTx = rows.find((r) => r.error_code === 'ERR_PAN_MISSING_OVER_50K');

    return {
      has_failed_pan_tx: Boolean(panMissingTx),
      recent_error_code: panMissingTx ? 'ERR_PAN_MISSING_OVER_50K' : null,
    };
  } catch (err) {
    console.warn('[kioskController] Failed to fetch account context:', err.message);
    return { has_failed_pan_tx: false, recent_error_code: null };
  }
}

/**
 * Log a FAQ query to the faq_query_log table for KB gap analysis.
 * Fire-and-forget — never throws, never blocks the response path.
 *
 * @param {object} opts
 * @param {string}  opts.accountId
 * @param {string}  opts.sessionId    - kiosk session identifier (from JWT sub or request id)
 * @param {string}  opts.queryText    - PII-redacted customer question
 * @param {string}  opts.domain       - matched category from FAQ agent (e.g. "KYC")
 * @param {boolean} opts.wasAnswered  - true if confidence >= 0.10
 * @param {number}  opts.confidence   - relevance score 0.0–1.0
 * @param {string}  opts.matchedFaqId - e.g. "fd-001" (null if no match)
 */
async function logFaqQuery({ accountId, sessionId, queryText, domain, wasAnswered, confidence, matchedFaqId }) {
  try {
    await query`
      INSERT INTO faq_query_log
        (account_id, session_id, query_text, detected_domain, was_answered, confidence, matched_faq_id)
      VALUES
        (${accountId || null},
         ${sessionId || null},
         ${queryText.slice(0, 2000)},
         ${domain || null},
         ${wasAnswered},
         ${confidence},
         ${matchedFaqId || null})
    `;
  } catch (err) {
    // Log but never let DB write failures affect the customer response
    console.warn('[kioskController] Failed to log FAQ query:', err.message);
  }
}

export async function handleKioskQuery(req, res) {
  const { query: customerQuery, language = 'auto' } = req.body;
  // req.auth is populated by requireRole('CUSTOMER') middleware (rbac.js)
  const accountId = req.auth?.accountId;
  const sessionId = req.auth?.jti || null;

  if (!customerQuery || !customerQuery.trim()) {
    return res.status(400).json({ error: 'query is required' });
  }

  if (!accountId) {
    return res.status(401).json({ error: 'Invalid or missing kiosk session' });
  }

  try {
    // 1. Fetch account context (failed transactions in last 24h)
    const accountContext = await fetchAccountContext(accountId);

    // 2. Localizer → Orchestrator pipeline
    const { routing, detectedLanguage, cleanText } = await processKioskQuery(
      customerQuery,
      accountContext,
      language
    );

    // 3. Audit this interaction (fire-and-forget — never block the response)
    emitAuthEvent('KIOSK_QUERY_ROUTED', {
      intent: routing.intent,
      downstream: routing.downstream,
      confidence: routing.confidence,
      detectedLanguage,
      contextOverride: routing.contextOverride,
    }, accountId);

    // 4. If intent is FAQ — fetch the answer from the FAQ RAG agent
    let faqAnswer;
    if (routing.intent === 'FAQ_QUERY') {
      const { answer, confident, domain, confidence: faqConfidence, matchedFaqId } =
        await askFaqAgent(cleanText);

      faqAnswer = answer;

      if (!confident) routing.downstream = 'teller_escalation';

      logFaqQuery({
        accountId, sessionId, queryText: cleanText,
        domain: domain ?? null, wasAnswered: confident,
        confidence: faqConfidence ?? 0, matchedFaqId: matchedFaqId ?? null,
      });

      emitAuthEvent('FAQ_QUERY_ANSWERED', {
        question: cleanText, confident, domain, confidence: faqConfidence,
      }, accountId);
    }

    // 4b. If intent is ACCOUNT_STATUS — query real CBS data for the authenticated customer
    let accountStatusPayload;
    if (routing.intent === 'ACCOUNT_STATUS') {
      try {
        const [accRows, txRows] = await Promise.all([
          query`
            SELECT account_number, full_name, balance, pan_linked
            FROM accounts WHERE id = ${accountId} LIMIT 1
          `,
          query`
            SELECT amount, error_code, created_at
            FROM transactions
            WHERE account_id = ${accountId}
            ORDER BY created_at DESC
            LIMIT 5
          `,
        ]);

        const acc = accRows[0];
        if (acc) {
          const maskedAccNum = String(acc.account_number).slice(-4);
          const balanceFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(acc.balance));
          const recentBlocks = txRows.filter((t) => t.error_code === 'ERR_PAN_MISSING_OVER_50K');
          const panStatus = acc.pan_linked ? 'linked and verified' : 'not yet linked';

          let voiceSummary = `Your account ending ${maskedAccNum} has a balance of ${balanceFmt}. Your PAN card is ${panStatus}.`;

          if (recentBlocks.length > 0 && !acc.pan_linked) {
            const blockedAmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(recentBlocks[0].amount));
            voiceSummary += ` You have ${recentBlocks.length} recent transaction${recentBlocks.length > 1 ? 's' : ''} blocked — the most recent was ${blockedAmt}. Please scan the QR code to upload your PAN card and lift the hold.`;
            routing.showQR = true;
          }

          routing.voiceResponse = voiceSummary;
          accountStatusPayload = {
            account_number_masked: `****${maskedAccNum}`,
            balance: Number(acc.balance),
            pan_linked: acc.pan_linked,
            blocked_tx_count: recentBlocks.length,
          };
        }
      } catch (err) {
        console.warn('[kioskController] ACCOUNT_STATUS DB query failed:', err.message);
        routing.voiceResponse = 'I was unable to retrieve your account details right now. Please speak with a teller.';
      }
    }

    // 6. Build and return the response
    const response = {
      intent:          routing.intent,
      downstream:      routing.downstream,
      voiceResponse:   routing.voiceResponse,
      showQR:          routing.showQR,
      confidence:      routing.confidence,
      detectedLanguage,
      ...(faqAnswer          && { faqAnswer }),
      ...(accountStatusPayload && { accountStatus: accountStatusPayload }),
    };

    return res.json(response);
  } catch (err) {
    console.error('[kioskController] Query pipeline error:', err.message);
    return res.status(500).json({
      error: 'Failed to process your query',
      voiceResponse: 'I\'m having trouble right now. Please speak with a teller.',
      intent: 'GENERAL_TRIAGE',
      downstream: 'teller_escalation',
      showQR: false,
    });
  }
}

/**
 * Server-Sent Events (SSE) token streaming endpoint.
 * Emits meta information instantly (< 10ms) and streams tokens in real-time.
 */
export async function handleKioskStream(req, res) {
  const customerQuery = req.body?.query || req.query?.query || req.body?.text || req.query?.text || '';
  const language = req.body?.language || req.query?.language || 'auto';
  const accountId = req.auth?.accountId || null;
  const sessionId = req.auth?.jti || null;

  if (!customerQuery.trim()) {
    return res.status(400).json({ error: 'query is required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const accountContext = accountId
      ? await fetchAccountContext(accountId)
      : { has_failed_pan_tx: false, recent_error_code: null };

    const { routing, detectedLanguage, cleanText } = await processKioskQuery(customerQuery, accountContext, language);

    let faqAnswer = null;
    if (routing.intent === 'FAQ_QUERY') {
      const faqRes = await askFaqAgent(cleanText);
      faqAnswer = faqRes.answer;
      if (!faqRes.confident) routing.downstream = 'teller_escalation';
      if (accountId) {
        logFaqQuery({ accountId, sessionId, queryText: cleanText, domain: faqRes.domain, wasAnswered: faqRes.confident, confidence: faqRes.confidence, matchedFaqId: faqRes.matchedFaqId });
      }
    }

    let accountStatusPayload;
    if (routing.intent === 'ACCOUNT_STATUS' && accountId) {
      try {
        const [accRows, txRows] = await Promise.all([
          query`SELECT account_number, full_name, balance, pan_linked FROM accounts WHERE id = ${accountId} LIMIT 1`,
          query`SELECT amount, error_code FROM transactions WHERE account_id = ${accountId} ORDER BY created_at DESC LIMIT 5`,
        ]);
        const acc = accRows[0];
        if (acc) {
          const masked = String(acc.account_number).slice(-4);
          const recentBlocks = txRows.filter((t) => t.error_code === 'ERR_PAN_MISSING_OVER_50K');
          let voiceSummary = `Your account ending ${masked} has a balance of ₹${Number(acc.balance).toLocaleString('en-IN')}. PAN status: ${acc.pan_linked ? 'Linked' : 'Not Linked'}.`;
          if (recentBlocks.length > 0 && !acc.pan_linked) {
            voiceSummary += ` You have ${recentBlocks.length} blocked transaction(s). Scan the QR code on screen to link your PAN.`;
            routing.showQR = true;
          }
          routing.voiceResponse = voiceSummary;
          accountStatusPayload = { account_number_masked: `****${masked}`, balance: Number(acc.balance), pan_linked: acc.pan_linked, blocked_tx_count: recentBlocks.length };
        }
      } catch (err) {
        console.warn('[handleKioskStream] account status lookup error:', err.message);
      }
    }

    const fullText = faqAnswer || routing.voiceResponse || 'A teller at the counter will be happy to help you.';

    // Send metadata event instantly (< 10ms)
    sendEvent('meta', {
      intent: routing.intent,
      downstream: routing.downstream,
      showQR: routing.showQR,
      confidence: routing.confidence,
      detectedLanguage,
      ...(accountStatusPayload && { accountStatus: accountStatusPayload }),
    });

    // Stream text tokens word-by-word with small interval for smooth typing visual effect
    const words = fullText.split(' ');
    for (let i = 0; i < words.length; i++) {
      const token = words[i] + (i < words.length - 1 ? ' ' : '');
      sendEvent('token', { token });
      await new Promise((r) => setTimeout(r, 15));
    }

    sendEvent('done', { fullText, intent: routing.intent, showQR: routing.showQR });
    res.end();
  } catch (err) {
    console.error('[kioskController] Streaming query error:', err.message);
    sendEvent('done', { fullText: "I'm having trouble right now. Please speak with a teller." });
    res.end();
  }
}

// ── Public Copilot endpoint (no auth) ────────────────────────────────────────
// Used by the landing page TORII Copilot widget.
// Routes using the local keyword fallback when watsonx is unavailable.
// Returns { response, actionChip? } shaped for the CopilotDrawer component.

// Intent → human readable response + action chip mapping
const INTENT_RESPONSES = {
  GREETING: {
    response:
      'Hello! Welcome to TORII Autonomous Branch. I can answer questions about FD interest rates, branch timings, KYC rules, or help you log in to solve account issues in seconds.',
    actionChip: { label: '📈 Check FD Rates', route: '/kiosk' },
    secondaryActions: [
      { label: '🔑 Log In to Account', route: '/kiosk/login' },
      { label: '🕒 Branch Timings', route: '/kiosk' }
    ]
  },
  PAN_MISSING: {
    response:
      'It looks like your PAN card needs to be linked. I can help you resolve this in under 60 seconds at our kiosk.',
    actionChip: { label: '⚡ Launch PAN Triage', route: '/kiosk' },
  },
  AML_BLOCKED: {
    response:
      'Your account has been flagged for a security review. A teller will assist you — please visit the HITL dashboard.',
    actionChip: { label: 'Open Teller Dashboard', route: '/teller' },
  },
  FAQ_QUERY: {
    response:
      'Great question! For the most accurate answer, use the kiosk triage system where our AI can check your account details.',
    actionChip: { label: 'Go to Kiosk', route: '/kiosk' },
  },
  ACCOUNT_STATUS: {
    response:
      'I can look up your account status. Head to the kiosk and enter your account number — I\'ll diagnose any issues instantly.',
    actionChip: { label: 'Check Account at Kiosk', route: '/kiosk' },
  },
  GENERAL_TRIAGE: {
    response:
      'I\'m here to help! For the fastest resolution, use the self-service kiosk. A teller is also available if needed.',
    actionChip: { label: 'Start Self-Service', route: '/kiosk' },
  },
};

// Keyword-based local fallback — mirrors intentRouter.js localFallbackRoute()
function detectIntent(text) {
  const t = text.trim().toLowerCase();
  if (/^(hi|hello|hey|good morning|good afternoon|good evening|greetings|who are you|help)$/i.test(t)) {
    return 'GREETING';
  }
  if (/pan|kyc|document|upload|link|50.?000|50k|verify identity|blocked.*card|card.*blocked/i.test(t)) {
    return 'PAN_MISSING';
  }
  if (/aml|suspicious|structuring|fraud|flagged/i.test(t)) {
    return 'AML_BLOCKED';
  }
  if (/what|how|when|where|why|interest|rate|fee|charge|limit|loan|fd|fixed deposit|neft|rtgs|upi|atm|ifsc|branch|hours/i.test(t)) {
    return 'FAQ_QUERY';
  }
  if (/status|transaction|transfer|pending|failed|error|problem|issue|stuck/i.test(t)) {
    return 'ACCOUNT_STATUS';
  }
  return 'GENERAL_TRIAGE';
}

export async function handlePublicCopilotQuery(req, res) {
  const rawText = req.body?.text || req.body?.query || '';

  if (!rawText.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }

  // 1. Check for Authorization header or x-kiosk-jwt
  const authHeader = req.headers.authorization || req.headers['x-kiosk-jwt'];
  let authenticatedAccount = null;

  if (authHeader) {
    try {
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const jwtSecret = process.env.JWT_SECRET || 'dev-secret-key-torii-2024';
      const jwtMod = await import('jsonwebtoken');
      const jwt = jwtMod.default || jwtMod;
      const decoded = jwt.verify(token, jwtSecret);
      if (decoded && decoded.sub) {
        // Query account details from PostgreSQL
        const [accRows, txRows] = await Promise.all([
          query`SELECT id, account_number, full_name, balance, pan_linked FROM accounts WHERE id = ${decoded.sub} LIMIT 1`,
          query`SELECT amount, error_code, created_at FROM transactions WHERE account_id = ${decoded.sub} AND error_code IS NOT NULL ORDER BY created_at DESC LIMIT 5`,
        ]);
        if (accRows.length > 0) {
          const acc = accRows[0];
          const recentBlocks = txRows.filter((t) => t.error_code === 'ERR_PAN_MISSING_OVER_50K');
          authenticatedAccount = {
            id: acc.id,
            accountNumber: acc.account_number,
            maskedNumber: `****${String(acc.account_number).slice(-4)}`,
            fullName: acc.full_name,
            balance: Number(acc.balance),
            panLinked: acc.pan_linked,
            blockedTxCount: recentBlocks.length,
            mostRecentAmount: recentBlocks[0]?.amount ? Number(recentBlocks[0].amount) : null,
          };
        }
      }
    } catch (err) {
      console.warn('[kioskController] Optional auth check failed in Copilot:', err.message);
    }
  }

  try {
    // 2. If authenticated customer, run Context-Aware Agentic Account Solver
    if (authenticatedAccount) {
      const { maskedNumber, fullName, panLinked, blockedTxCount, mostRecentAmount } = authenticatedAccount;
      const isAccountQuery = /fix|resolve|issue|problem|block|error|pan|hold|status|transaction|deposit|failed|50k|50.?000/i.test(rawText);

      if (!panLinked || blockedTxCount > 0 || isAccountQuery) {
        const amtStr = mostRecentAmount ? `₹${mostRecentAmount.toLocaleString('en-IN')}` : '₹50,000+';
        const agenticText = !panLinked || blockedTxCount > 0
          ? `Welcome ${fullName}! I have diagnosed your account (${maskedNumber}). Proactive Radar detected ${blockedTxCount || 1} active failure(s): transaction of ${amtStr} is blocked due to unlinked PAN (ERR_PAN_MISSING_OVER_50K). You can resolve this immediately in seconds.`
          : `Hello ${fullName}! Your account (${maskedNumber}) is in good standing. Balance is ₹${authenticatedAccount.balance.toLocaleString('en-IN')}. How can I assist your banking session today?`;

        return res.json({
          authenticated: true,
          accountContext: {
            maskedNumber,
            fullName,
            panLinked,
            blockedTxCount: blockedTxCount || 1,
            errorCode: 'ERR_PAN_MISSING_OVER_50K',
          },
          response: agenticText,
          actionChip: !panLinked || blockedTxCount > 0
            ? { label: '⚡ Execute Agentic Fix Now', route: '/kiosk/triage?action=fix_pan' }
            : { label: 'Go to Kiosk Triage', route: '/kiosk/triage' },
          secondaryActions: [
            { label: '👨‍💼 Speak to Teller', route: '/teller' },
            { label: '📄 Account Overview', route: '/kiosk/triage' }
          ],
          intent: 'ACCOUNT_STATUS',
        });
      }
    }

    // 3. Unauthenticated / Public Mode — General FAQ Answers
    let intent = 'GENERAL_TRIAGE';
    let voiceResponse = null;

    try {
      const { processKioskQuery } = await import('../ai/intentRouter.js');
      const { routing } = await processKioskQuery(rawText, {});
      intent = routing.intent ?? 'GENERAL_TRIAGE';
      voiceResponse = routing.voiceResponse ?? null;
    } catch {
      intent = detectIntent(rawText);
    }

    // Check FAQ RAG agent for general queries
    let faqResponseText = null;
    try {
      const { askFaqAgent } = await import('../ai/faqAgent.js');
      const faqResult = await askFaqAgent(rawText);
      if (faqResult && faqResult.answer) {
        faqResponseText = faqResult.answer;
      }
    } catch (faqErr) {
      console.warn('[kioskController] FAQ RAG fallback error:', faqErr.message);
    }

    const mapped = INTENT_RESPONSES[intent] ?? INTENT_RESPONSES.GENERAL_TRIAGE;

    const finalAnswer = (faqResponseText && !/let me look that up/i.test(faqResponseText))
      ? faqResponseText
      : (voiceResponse && !/let me look that up/i.test(voiceResponse) ? voiceResponse : mapped.response);

    return res.json({
      authenticated: false,
      response: finalAnswer,
      voiceResponse: finalAnswer,
      faqAnswer: finalAnswer,
      actionChip: mapped.actionChip ?? (authenticatedAccount
        ? { label: 'Go to Kiosk Triage', route: '/kiosk/triage' }
        : { label: '🔑 Log In to Solve Account Issues', route: '/kiosk/login' }),
      secondaryActions: mapped.secondaryActions ?? [],
      intent,
    });
  } catch (err) {
    console.error('[kioskController] handlePublicCopilotQuery error:', err.message);
    const fallbackIntent = detectIntent(rawText);
    const mapped = INTENT_RESPONSES[fallbackIntent] || INTENT_RESPONSES.GENERAL_TRIAGE;
    return res.json({
      authenticated: false,
      response: mapped.response,
      actionChip: mapped.actionChip || { label: 'Open Kiosk', route: '/kiosk' },
      secondaryActions: mapped.secondaryActions || [],
      intent: fallbackIntent,
    });
  }
}

