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

      // If not confident, upgrade routing downstream to teller escalation
      if (!confident) {
        routing.downstream = 'teller_escalation';
      }

      // 5. Log every FAQ query for KB gap analysis (fire-and-forget)
      logFaqQuery({
        accountId,
        sessionId,
        queryText: cleanText,
        domain:       domain       ?? null,
        wasAnswered:  confident,
        confidence:   faqConfidence ?? 0,
        matchedFaqId: matchedFaqId ?? null,
      });

      emitAuthEvent('FAQ_QUERY_ANSWERED', {
        question: cleanText,
        confident,
        domain,
        confidence: faqConfidence,
      }, accountId);
    }

    // 6. Build and return the response
    const response = {
      intent:          routing.intent,
      downstream:      routing.downstream,
      voiceResponse:   routing.voiceResponse,
      showQR:          routing.showQR,
      confidence:      routing.confidence,
      detectedLanguage,
      ...(faqAnswer && { faqAnswer }),
    };

    return res.json(response);
  } catch (err) {
    console.error('[kioskController] Query pipeline error:', err.message);
    return res.status(500).json({
      error: 'Failed to process your query',
      // Safe fallback so the kiosk can still speak something
      voiceResponse: 'I\'m having trouble right now. Please speak with a teller.',
      intent: 'GENERAL_TRIAGE',
      downstream: 'teller_escalation',
      showQR: false,
    });
  }
}
