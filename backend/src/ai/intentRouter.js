// backend/src/ai/intentRouter.js
// Master Orchestrator intent routing.
//
// Calls the watsonx Orchestrate Master Orchestrator agent to classify the
// customer's intent and determine the correct downstream flow.
//
// Intents returned:
//   PAN_MISSING      → show QR code for mobile handoff
//   FAQ_QUERY        → call faqAgent.js, speak the answer via TTS
//   ACCOUNT_STATUS   → query DB for account info
//   GENERAL_TRIAGE   → direct customer to teller counter
//
// Env vars required:
//   WXO_ORCHESTRATOR_AGENT_ID — Orchestrate agent ID for the Master Orchestrator
//   WXO_LOCALIZER_AGENT_ID    — Orchestrate agent ID for the Localizer

import { chatWithAgentJSON, chatWithAgent } from './orchestrateClient.js';

const ORCHESTRATOR_AGENT_ID = process.env.WXO_ORCHESTRATOR_AGENT_ID || 'torii_master_orchestrator_agent';
const LOCALIZER_AGENT_ID    = process.env.WXO_LOCALIZER_AGENT_ID    || 'torii_localizer_agent';

/**
 * Pre-process raw kiosk input through the Localizer agent.
 * Detects language, redacts PII, returns clean English text.
 *
 * @param {string} rawText — Raw transcribed or typed input from kiosk
 * @param {string} [declaredLanguage='auto'] — ISO 639-1 code or 'auto'
 * @returns {Promise<{cleanText: string, detectedLanguage: string, piiRedacted: string[]}>}
 */
export async function localizeInput(rawText, declaredLanguage = 'auto') {
  const prompt =
    `Process this kiosk input through language detection and PII redaction.\n` +
    `raw_text: "${rawText}"\n` +
    `declared_language: "${declaredLanguage}"\n\n` +
    `Call the process_kiosk_input tool and return the clean English text as a plain string.`;

  try {
    const result = await chatWithAgent(LOCALIZER_AGENT_ID, prompt, null);
    // The Localizer agent returns the clean text as a plain string
    const cleanText = typeof result === 'string' ? result.trim() : rawText;
    return {
      cleanText,
      detectedLanguage: 'en', // Localizer handles translation internally
      piiRedacted: [],
    };
  } catch (err) {
    console.warn('[intentRouter] Localizer agent failed, using raw input:', err.message);
    // Graceful degradation — pass through with basic PAN redaction
    const fallback = rawText.replace(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/g, '[PAN_REDACTED]');
    return { cleanText: fallback, detectedLanguage: 'en', piiRedacted: [] };
  }
}

/**
 * Translate a response back to the customer's language using the Localizer agent.
 *
 * @param {string} englishText
 * @param {string} targetLanguage — ISO 639-1 code, e.g. 'hi', 'ta'
 * @returns {Promise<string>} Translated text (or original if target is 'en')
 */
export async function translateResponse(englishText, targetLanguage = 'en') {
  if (!targetLanguage || targetLanguage === 'en') return englishText;

  const prompt =
    `Translate this English text to ${targetLanguage}.\n` +
    `english_text: "${englishText}"\n` +
    `target_language: "${targetLanguage}"\n\n` +
    `Call the translate_response_to_language tool and return ONLY the translated text.`;

  try {
    const translated = await chatWithAgent(LOCALIZER_AGENT_ID, prompt, null);
    return typeof translated === 'string' && translated.trim()
      ? translated.trim()
      : englishText;
  } catch (err) {
    console.warn('[intentRouter] Translation failed, returning English:', err.message);
    return englishText;
  }
}

/**
 * Route a customer's kiosk query through the Master Orchestrator agent.
 *
 * @param {string} cleanText — PII-redacted English text from localizeInput()
 * @param {object} accountContext — { has_failed_pan_tx, recent_error_code }
 * @returns {Promise<{
 *   intent: string,
 *   downstream: string,
 *   confidence: number,
 *   voiceResponse: string,
 *   showQR: boolean,
 *   contextOverride: boolean
 * }>}
 */
export async function routeIntent(cleanText, accountContext = {}) {
  const contextJson = JSON.stringify({
    has_failed_pan_tx: accountContext.has_failed_pan_tx ?? false,
    recent_error_code: accountContext.recent_error_code ?? null,
  });

  const prompt =
    `Classify this customer intent and return a routing decision.\n` +
    `clean_text: "${cleanText}"\n` +
    `account_context: ${contextJson}\n\n` +
    `Call the classify_customer_intent tool and return ONLY a JSON object with keys: ` +
    `intent, downstream, confidence, voice_response, show_qr, context_override.`;

  const result = await chatWithAgentJSON(ORCHESTRATOR_AGENT_ID, prompt, null);

  if (!result || !result.intent) {
    // Orchestrate agent unavailable or misconfigured — use keyword-based local fallback
    // so the kiosk remains functional during hackathon / dev setup.
    console.warn('[intentRouter] Orchestrator unavailable, using local keyword fallback');
    return localFallbackRoute(cleanText, accountContext);
  }

  return {
    intent:          result.intent,
    downstream:      result.downstream,
    confidence:      result.confidence ?? 0,
    voiceResponse:   result.voice_response ?? 'How can I help you today?',
    showQR:          result.show_qr === true,
    contextOverride: result.context_override === true,
  };
}

/**
 * Local keyword-based intent router used when the WXO Orchestrator agent is
 * unavailable or mis-configured.  Covers the four intents the kiosk handles.
 * Not ML-powered — good enough for demo / dev fallback.
 *
 * @param {string} text
 * @param {object} accountContext
 * @returns {{ intent, downstream, confidence, voiceResponse, showQR, contextOverride }}
 */
function localFallbackRoute(text, accountContext) {
  const t = text.toLowerCase().trim();

  // 1. Greeting / Conversational check
  if (/^(hi|hello|hey|good morning|good afternoon|good evening|greetings|who are you|help)$/i.test(t)) {
    return {
      intent: 'FAQ_QUERY',
      downstream: 'faq_agent',
      confidence: 0.9,
      voiceResponse: 'Hello! Welcome to TORII Autonomous Branch. How can I help you today?',
      showQR: false,
      contextOverride: false,
    };
  }

  // 2a. Service Intent Routing — Address Change
  if (/address|moved|flat|house|street|city|pincode/i.test(t)) {
    return {
      intent: 'ADDRESS_CHANGE',
      downstream: 'service_handoff',
      serviceType: 'ADDRESS_CHANGE',
      confidence: 0.85,
      voiceResponse: 'I can help you update your residential address. Please scan the QR code to upload your address proof document.',
      showQR: true,
      contextOverride: false,
    };
  }

  // 2b. Service Intent Routing — Nominee Update
  if (/nominee|beneficiary|guardian|inherit/i.test(t)) {
    return {
      intent: 'NOMINEE_UPDATE',
      downstream: 'service_handoff',
      serviceType: 'NOMINEE_UPDATE',
      confidence: 0.85,
      voiceResponse: 'I can assist you with adding or modifying your account nominee. Scan the QR code to complete the nomination details.',
      showQR: true,
      contextOverride: false,
    };
  }

  // 2c. Service Intent Routing — Aadhaar Linking
  if (/aadhaar|uidai|dbt|npci/i.test(t)) {
    return {
      intent: 'AADHAAR_LINK',
      downstream: 'service_handoff',
      serviceType: 'AADHAAR_LINK',
      confidence: 0.85,
      voiceResponse: 'I can help link your Aadhaar card for Direct Benefit Transfer. Scan the QR code to submit your Aadhaar card.',
      showQR: true,
      contextOverride: false,
    };
  }

  // 2d. Service Intent Routing — Full CKYC / Re-KYC
  if (/full kyc|ckyc|re-kyc|rekyc|complete kyc/i.test(t)) {
    return {
      intent: 'FULL_KYC',
      downstream: 'service_handoff',
      serviceType: 'FULL_KYC',
      confidence: 0.90,
      voiceResponse: 'Let us complete your full CKYC verification. Scan the QR code with your smartphone to fill the application form and upload your ID documents.',
      showQR: true,
      contextOverride: false,
    };
  }

  // 2e. Service Intent Routing — Account Upgrade / Cards / Chequebook
  if (/upgrade|debit card|chequebook|cheque book/i.test(t)) {
    return {
      intent: 'ACCOUNT_UPGRADE',
      downstream: 'service_handoff',
      serviceType: 'ACCOUNT_UPGRADE',
      confidence: 0.85,
      voiceResponse: 'I can help you upgrade your account tier and request a new debit card or chequebook. Scan the QR code to proceed.',
      showQR: true,
      contextOverride: false,
    };
  }

  // 2f. Service Intent Routing — High-Value Pre-Clearance
  if (/high value|invoice|large transaction|pre-clearance/i.test(t)) {
    return {
      intent: 'HIGH_VALUE_CLEARANCE',
      downstream: 'service_handoff',
      serviceType: 'HIGH_VALUE_CLEARANCE',
      confidence: 0.85,
      voiceResponse: 'For high-value transaction pre-clearance, please scan the QR code to declare your source of funds and attach invoice documentation.',
      showQR: true,
      contextOverride: false,
    };
  }

  // 3. Explicit FAQ — general banking questions (interest rates, branch hours, FD, loans, limits, etc.)
  if (
    /what|how|when|where|why|interest|rate|fee|charge|limit|loan|fd|fixed deposit|saving|current|neft|rtgs|upi|atm|card|block|ifsc|branch|hours|open|close|minimum|balance/i.test(t)
  ) {
    return {
      intent: 'FAQ_QUERY',
      downstream: 'faq_agent',
      confidence: 0.85,
      voiceResponse: 'Let me look that up for you.',
      showQR: false,
      contextOverride: false,
    };
  }

  // 2b. Service Intent Routing — Address Change
  if (/address|moved|flat|house|street|city|pincode/i.test(t)) {
    return {
      intent: 'ADDRESS_CHANGE',
      downstream: 'service_handoff',
      serviceType: 'ADDRESS_CHANGE',
      confidence: 0.85,
      voiceResponse: 'I can help you update your residential address. Please scan the QR code to upload your address proof document.',
      showQR: true,
      contextOverride: false,
    };
  }

  // 2c. Service Intent Routing — Nominee Update
  if (/nominee|beneficiary|guardian|inherit/i.test(t)) {
    return {
      intent: 'NOMINEE_UPDATE',
      downstream: 'service_handoff',
      serviceType: 'NOMINEE_UPDATE',
      confidence: 0.85,
      voiceResponse: 'I can assist you with adding or modifying your account nominee. Scan the QR code to complete the nomination details.',
      showQR: true,
      contextOverride: false,
    };
  }

  // 2d. Service Intent Routing — Aadhaar Linking
  if (/aadhaar|uidai|dbt|npci/i.test(t)) {
    return {
      intent: 'AADHAAR_LINK',
      downstream: 'service_handoff',
      serviceType: 'AADHAAR_LINK',
      confidence: 0.85,
      voiceResponse: 'I can help link your Aadhaar card for Direct Benefit Transfer. Scan the QR code to submit your Aadhaar card.',
      showQR: true,
      contextOverride: false,
    };
  }

  // 2e. Service Intent Routing — Full CKYC / Re-KYC
  if (/full kyc|ckyc|re-kyc|rekyc|complete kyc/i.test(t)) {
    return {
      intent: 'FULL_KYC',
      downstream: 'service_handoff',
      serviceType: 'FULL_KYC',
      confidence: 0.90,
      voiceResponse: 'Let us complete your full CKYC verification. Scan the QR code with your smartphone to fill the application form and upload your ID documents.',
      showQR: true,
      contextOverride: false,
    };
  }

  // 2f. Service Intent Routing — Account Upgrade / Cards / Chequebook
  if (/upgrade|debit card|chequebook|cheque book/i.test(t)) {
    return {
      intent: 'ACCOUNT_UPGRADE',
      downstream: 'service_handoff',
      serviceType: 'ACCOUNT_UPGRADE',
      confidence: 0.85,
      voiceResponse: 'I can help you upgrade your account tier and request a new debit card or chequebook. Scan the QR code to proceed.',
      showQR: true,
      contextOverride: false,
    };
  }

  // 2g. Service Intent Routing — High-Value Pre-Clearance
  if (/high value|invoice|large transaction|pre-clearance/i.test(t)) {
    return {
      intent: 'HIGH_VALUE_CLEARANCE',
      downstream: 'service_handoff',
      serviceType: 'HIGH_VALUE_CLEARANCE',
      confidence: 0.85,
      voiceResponse: 'For high-value transaction pre-clearance, please scan the QR code to declare your source of funds and attach invoice documentation.',
      showQR: true,
      contextOverride: false,
    };
  }

  // 3. PAN / KYC missing — explicit request OR account status error query
  if (
    /pan|kyc|document|upload|link|50.?000|50k|verify identity/i.test(t) ||
    (accountContext.has_failed_pan_tx && /status|my account|problem|issue|block|resolve|fix|failed|error/i.test(t))
  ) {
    return {
      intent: 'PAN_MISSING',
      downstream: 'mobile_handoff',
      serviceType: 'PAN_LINK',
      confidence: 0.75,
      voiceResponse:
        'It looks like we need your PAN card to proceed. ' +
        'Please scan the QR code with your phone to upload your document.',
      showQR: true,
      contextOverride: false,
    };
  }

  // 4. Account status check
  if (/status|transaction|transfer|pending|failed|error|problem|issue|stuck/i.test(t)) {
    return {
      intent: 'ACCOUNT_STATUS',
      downstream: 'account_lookup',
      confidence: 0.6,
      voiceResponse: 'Let me check your account status.',
      showQR: false,
      contextOverride: false,
    };
  }

  // 5. Default — send to teller
  return {
    intent: 'GENERAL_TRIAGE',
    downstream: 'teller_escalation',
    confidence: 0.5,
    voiceResponse:
      'I\'ll connect you with a teller who can help with that. ' +
      'Please proceed to the nearest counter.',
    showQR: false,
    contextOverride: false,
  };
}

/**
 * Full pipeline: raw kiosk input → localize → route intent.
 * This is the primary entry point called by kioskController.js.
 *
 * @param {string} rawText
 * @param {object} accountContext
 * @param {string} [declaredLanguage='auto']
 * @returns {Promise<{routing: object, detectedLanguage: string, cleanText: string}>}
 */
export async function processKioskQuery(rawText, accountContext = {}, declaredLanguage = 'auto') {
  if (!rawText || !rawText.trim()) {
    return {
      routing: localFallbackRoute('help', accountContext),
      detectedLanguage: 'en',
      cleanText: '',
    };
  }

  // 1. Fast-path check: local fallback route (< 1ms)
  const localRoute = localFallbackRoute(rawText, accountContext);
  const isPlainAscii = /^[\x00-\x7F]+$/.test(rawText.trim());

  if (isPlainAscii && localRoute.confidence >= 0.75) {
    return {
      routing: localRoute,
      detectedLanguage: 'en',
      cleanText: rawText.trim(),
    };
  }

  // 2. Parallel path: Run localizer and routeIntent concurrently via Promise.all
  try {
    const [locResult, routeResult] = await Promise.all([
      localizeInput(rawText, declaredLanguage).catch(() => ({ cleanText: rawText, detectedLanguage: 'en' })),
      routeIntent(rawText, accountContext).catch(() => localRoute),
    ]);

    const cleanText = locResult?.cleanText || rawText;
    const detectedLanguage = locResult?.detectedLanguage || 'en';
    const routing = routeResult?.intent ? routeResult : localRoute;

    if (detectedLanguage && detectedLanguage !== 'en' && routing.voiceResponse) {
      routing.voiceResponse = await translateResponse(routing.voiceResponse, detectedLanguage).catch(() => routing.voiceResponse);
    }

    return { routing, detectedLanguage, cleanText };
  } catch (_) {
    return { routing: localRoute, detectedLanguage: 'en', cleanText: rawText };
  }
}
