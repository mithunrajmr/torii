// backend/src/ai/faqAgent.js
// FAQ / QnA Diagnostic RAG agent client.
//
// Calls the watsonx Orchestrate FAQ agent to answer a customer's general
// banking question at the kiosk. The FAQ agent searches the 40-entry
// bank policy knowledge base and returns a plain-English answer.
//
// Session 3 changes:
//   - Returns domain, confidence, matchedFaqId for faq_query_log tracking
//   - Confidence threshold aligned with agent instructions (0.10 partial / 0.20 confident)
//
// Env vars required:
//   WXO_FAQ_AGENT_ID — Orchestrate agent ID for the FAQ/QnA agent

import { chatWithAgent } from './orchestrateClient.js';
import { GoogleGenAI } from '@google/genai';

const FAQ_AGENT_ID = process.env.WXO_FAQ_AGENT_ID || 'torii_faq_agent';

/**
 * Generate a dynamic banking answer using Google Gemini Flash AI when Watsonx is offline or un-matched.
 */
async function generateGeminiFaqAnswer(question) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  try {
    const ai = new GoogleGenAI({ apiKey });
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const response = await ai.models.generateContent({
      model,
      contents: [{
        text: `You are TORII Autonomous Banking Copilot AI. Answer this bank kiosk customer's question clearly and helpfully in 2-3 concise sentences. Do not use markdown headers.\nQuestion: "${question}"\nAnswer:`
      }],
    });
    const text = (response.text || '').trim();
    console.log(`[faqAgent] Raw Gemini Flash FAQ Output:\n"${text}"`);
    return text || null;
  } catch (err) {
    console.warn('[faqAgent] Gemini Flash AI FAQ fallback error:', err.message);
    return null;
  }
}

// ─── Static local FAQ KB (fallback when WXO agent is unavailable) ─────────────
const LOCAL_FAQ = [
  { q: /^(hi|hello|hey|good morning|good afternoon|good evening|greetings|who are you|help)$/i, a: 'Hello! I am TORII Copilot. I can answer questions about FD interest rates, branch timings, KYC requirements, or help you log in to resolve account holds in seconds. What can I help you with today?' },
  { q: /interest rate|fd rate|fixed deposit rate/i,       a: 'Our current FD interest rates range from 5.5% to 7.25% p.a. depending on the tenure. Please visit the branch or our website for the latest rates.' },
  { q: /savings account interest/i,                       a: 'We offer 3.5% p.a. interest on savings accounts, credited quarterly.' },
  { q: /minimum balance|average monthly balance/i,        a: 'The minimum average monthly balance for savings accounts is ₹5,000. Non-maintenance charges of ₹150 apply.' },
  { q: /atm|debit card.*limit|withdrawal limit/i,         a: 'The daily ATM withdrawal limit is ₹20,000 and POS purchase limit is ₹1,00,000.' },
  { q: /neft|rtgs|imps|transfer charges|transfer fee/i,   a: 'NEFT and RTGS are free for online transactions. IMPS up to ₹1,000 is ₹3.50; above that is ₹5.' },
  { q: /upi|gpay|phonepe|paytm/i,                         a: 'UPI transactions are free of charge. Your UPI ID is linked to your registered mobile number.' },
  { q: /block.*card|lost card|stolen card/i,              a: 'To block your card immediately, call our 24×7 helpline at 1800-XXX-XXXX or use the mobile banking app.' },
  { q: /ifsc|branch code/i,                               a: 'Your branch IFSC code is printed on the top of your cheque leaf and passbook. You can also find it on our website.' },
  { q: /branch.*hours|open.*time|close.*time|working hours/i, a: 'Our branches are open Monday to Friday 9:30 AM – 5:30 PM and Saturday 9:30 AM – 1:30 PM. Closed on Sundays and public holidays.' },
  { q: /loan|home loan|personal loan|car loan/i,          a: 'We offer home loans from 8.5% p.a., personal loans from 10.5% p.a., and car loans from 7.9% p.a. Visit any branch or apply online.' },
  { q: /pan|kyc|know your customer/i,                     a: 'PAN card is mandatory for transactions above ₹50,000. Please upload your PAN using the QR code on screen.' },
  { q: /cheque book|passbook/i,                           a: 'Request a cheque book or passbook update at any branch counter or through our mobile banking app.' },
  { q: /nominee|add nominee/i,                            a: 'You can add or update a nominee through the mobile banking app or by submitting a Nomination Form (DA-1) at your branch.' },
  { q: /credit card/i,                                    a: 'To apply for a credit card, visit any branch with your ID proof, address proof, and income documents. Minimum income criteria applies.' },
  { q: /account.*open|open.*account/i,                    a: 'To open a new account, visit any branch with your Aadhaar card, PAN card, and passport-size photographs.' },
];

/**
 * Ask the FAQ/QnA RAG agent a banking question.
 *
 * @param {string} question — Customer's question in plain English (PII already redacted)
 * @returns {Promise<{
 *   answer:       string,   — Plain text answer ready for TTS/display
 *   confident:    boolean,  — false if agent deflected to teller (low confidence)
 *   domain:       string|null,  — KB category matched (e.g. "DEPOSITS", "KYC")
 *   confidence:   number,   — best relevance_score 0.0–1.0 (0 if unknown)
 *   matchedFaqId: string|null,  — e.g. "fd-001" if a specific entry was matched
 * }>}
 */
export async function askFaqAgent(question) {
  if (!question || !question.trim()) {
    return {
      answer: 'How can I help you? Please type your banking question below.',
      confident: false,
      domain: null,
      confidence: 0,
      matchedFaqId: null,
    };
  }

  // 1. Instant local KB lookup (< 1ms execution)
  const localMatch = localFaqLookup(question);

  // Fast-path: If local KB has a confident match (e.g. FD rates, timings, KYC, limits), return instantly!
  if (localMatch.confident) {
    return localMatch;
  }

  // 2. Unmatched / complex question — race WXO agent and Gemini Flash AI in PARALLEL
  const prompt =
    `Answer this customer's banking question at the kiosk.\n` +
    `Customer question: "${question}"\n\n` +
    `Call the search_bank_faq tool (domain_filter="") then call log_faq_query, ` +
    `and return ONLY the answer text — no JSON, no markdown, no labels.`;

  try {
    const wxoPromise = chatWithAgent(FAQ_AGENT_ID, prompt, null).catch(() => null);
    const geminiPromise = generateGeminiFaqAnswer(question).catch(() => null);
    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 3500));

    // Race remote WXO and Gemini AI in parallel
    const winner = await Promise.race([
      wxoPromise.then((res) => (res && typeof res === 'string' && res.trim() ? res : null)),
      geminiPromise.then((res) => (res && typeof res === 'string' && res.trim() ? res : null)),
      timeoutPromise,
    ]);

    const answerText = winner ? winner.trim() : null;
    if (answerText && answerText.length > 5) {
      const deflectedToTeller = /teller|counter|branch staff|speak with|visit the branch/i.test(answerText);
      return {
        answer:       answerText,
        confident:    !deflectedToTeller,
        domain:       'AI_SWARM',
        confidence:   deflectedToTeller ? 0.05 : 0.85,
        matchedFaqId: null,
      };
    }
  } catch (err) {
    console.warn('[faqAgent] Parallel AI FAQ lookup error:', err.message);
  }

  return localMatch;
}

/**
 * Keyword-match fallback against the static local FAQ table.
 * Used when the WXO FAQ agent is unreachable.
 */
function localFaqLookup(question) {
  const match = LOCAL_FAQ.find(({ q }) => q.test(question));
  if (match) {
    return {
      answer:       match.a,
      confident:    true,
      domain:       'LOCAL_KB',
      confidence:   0.7,
      matchedFaqId: null,
    };
  }
  return {
    answer:
      'I don\'t have a specific answer for that right now. ' +
      'A teller at the counter will be happy to help you.',
    confident:    false,
    domain:       null,
    confidence:   0,
    matchedFaqId: null,
  };
}
