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

async function generateGeminiFaqAnswer(question) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const modelsToTry = Array.from(new Set([
    process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash',
    'gemini-flash-latest'
  ]));

  try {
    const ai = new GoogleGenAI({ apiKey });
    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [{
            text: `You are TORII Autonomous Banking Copilot AI. Answer this customer's question directly, accurately, and concisely in 2-3 sentences. Provide exact information — do not output generic placeholder phrases or markdown headers.\nQuestion: "${question}"\nAnswer:`
          }],
        });
        const text = (response.text || '').trim();
        if (text && text.length > 15 && !isPlaceholderResponse(text)) {
          console.log(`[faqAgent] ✓ Gemini AI (${model}) Dynamic Output:\n"${text}"`);
          return text;
        }
      } catch (mErr) {
        // try next model in fallback list
      }
    }
  } catch (err) {
    console.warn('[faqAgent] Gemini AI FAQ fallback error:', err.message);
  }
  return null;
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
function isPlaceholderResponse(text) {
  if (!text || typeof text !== 'string') return true;
  const t = text.toLowerCase().trim();
  return (
    t.length < 12 ||
    t.includes('let me look that up') ||
    t.includes('great question') ||
    t.includes('how can i help you today') ||
    t.includes('sure, here\'s some information') ||
    t.startsWith('{')
  );
}

function intelligentDomainAnswer(question) {
  const q = (question || '').toLowerCase();
  
  if (/^(hi|hello|hey|good morning|good afternoon|good evening|greetings|who are you|help)$/i.test(q.trim())) {
    return 'Hello! Welcome to TORII Autonomous Branch. I can answer questions about FD interest rates, branch timings, KYC requirements, or help you log in to resolve account holds in seconds. What can I help you with today?';
  }
  if (/fd|interest|rate|deposit|fixed/i.test(q)) {
    return 'Our current Fixed Deposit interest rates range from 5.50% to 7.25% per annum depending on tenure. Senior citizens receive an additional 0.50% interest bonus.';
  }
  if (/pan|kyc|50k|50.?000|upload|link|document/i.test(q)) {
    return 'PAN card verification is mandatory for banking transactions exceeding ₹50,000 under RBI rules. You can scan the QR code on screen to link your PAN card in under 60 seconds.';
  }
  if (/high value|invoice|clearance|large transaction/i.test(q)) {
    return 'For high-value transaction pre-clearance, please submit proof of funds or invoice documentation using the QR code on screen.';
  }
  if (/card|block|lost|stolen|debit|credit/i.test(q)) {
    return 'To block a lost or stolen debit or credit card immediately, call our 24x7 helpline at 1800-111-2222 or block it instantly via the mobile banking app.';
  }
  if (/hours|time|timing|open|close|sunday|saturday/i.test(q)) {
    return 'Our branch operations are open Monday to Friday from 9:30 AM to 5:30 PM, and on 1st and 3rd Saturdays from 9:30 AM to 1:30 PM.';
  }
  if (/neft|rtgs|imps|transfer|fee|charge|money/i.test(q)) {
    return 'NEFT and RTGS online transfers are free of charge 24x7. IMPS transfers incur a nominal ₹3.50 charge for amounts up to ₹1,000.';
  }
  if (/loan|home loan|personal loan|car loan/i.test(q)) {
    return 'We offer home loans starting from 8.50% per annum, personal loans from 10.50% per annum, and car loans from 7.90% per annum. You can apply online or at any branch counter.';
  }
  if (/account|savings|balance|minimum/i.test(q)) {
    return 'We offer 3.50% annual interest on savings accounts credited quarterly. Minimum average monthly balance requirement is ₹5,000.';
  }
  if (/upi|gpay|phonepe|paytm/i.test(q)) {
    return 'UPI transactions are free of charge 24x7. Your UPI ID is linked directly to your registered mobile number.';
  }
  if (/address|moved|pincode|house/i.test(q)) {
    return 'You can update your residential address by uploading an updated Aadhaar card or utility bill via our mobile app or at the kiosk.';
  }
  if (/nominee|beneficiary/i.test(q)) {
    return 'You can add or update your account nominee through the mobile banking app or by submitting Form DA-1 at any branch counter.';
  }

  return 'TORII autonomous banking system provides full self-service for account inquiries, transfer clearance, and document updates. Ask me about FD rates, loan options, branch hours, or PAN verification.';
}

function cleanOrchestrateText(text) {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text.trim();

  // Handle SSE duplicated strings: "Sentence A. Sentence A."
  const halfMatch = cleaned.match(/^([\s\S]+?)\s*\1$/);
  if (halfMatch && halfMatch[1]) {
    cleaned = halfMatch[1].trim();
  }

  // Handle JSON output embedded in string
  if (cleaned.startsWith('{') || cleaned.includes('"voice_response"')) {
    try {
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        const parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
        cleaned = parsed.voice_response || parsed.answer || parsed.response || cleaned;
      }
    } catch (_) {}
  }

  return cleaned;
}

/**
 * Ask the FAQ/QnA RAG agent a banking question.
 * DUAL ENGINE ARCHITECTURE:
 * Both the Local Engine and IBM watsonx Orchestrate AI Engine are dispatched PARALLEL.
 * If the Local Engine matches with high confidence, it returns INSTANTLY (<1ms).
 * If the Local Engine does not match, execution seamlessly awaits the IBM watsonx / Gemini AI Engine.
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

  const prompt =
    `Answer this customer's banking question at the kiosk.\n` +
    `Customer question: "${question}"\n\n` +
    `Return ONLY the direct plain English answer.`;

  // 1. ENGINE 1 (PARALLEL DISPATCH): IBM watsonx Orchestrate AI Agent Call
  const ibmEnginePromise = (async () => {
    try {
      const rawWxo = await chatWithAgent(FAQ_AGENT_ID, prompt, null);
      const cleanWxo = cleanOrchestrateText(rawWxo);

      if (cleanWxo && cleanWxo.length > 15 && !isPlaceholderResponse(cleanWxo)) {
        console.log(`[faqAgent] ✓ Dual Engine: IBM watsonx Orchestrate Output:\n"${cleanWxo}"`);
        const deflectedToTeller = /teller|counter|branch staff|speak with|visit the branch/i.test(cleanWxo);
        return {
          answer:       cleanWxo,
          confident:    !deflectedToTeller,
          domain:       'IBM_WATSONX_ORCHESTRATE',
          confidence:   deflectedToTeller ? 0.05 : 0.95,
          matchedFaqId: null,
        };
      }
    } catch (err) {
      console.warn('[faqAgent] Dual Engine: IBM watsonx Orchestrate call failed:', err.message);
    }
    return null;
  })();

  // 2. ENGINE 2 (PARALLEL DISPATCH): Local Instant KB & Domain Evaluation (< 1ms)
  const localMatch = localFaqLookup(question);
  if (localMatch.confident) {
    console.log(`[faqAgent] ✓ Dual Engine Instant Local KB Win:\n"${localMatch.answer}"`);
    return localMatch;
  }

  const domainAns = intelligentDomainAnswer(question);
  if (domainAns && !domainAns.includes('autonomous banking system provides full self-service')) {
    console.log(`[faqAgent] ✓ Dual Engine Instant Domain KB Win:\n"${domainAns}"`);
    return {
      answer: domainAns,
      confident: true,
      domain: 'INTELLIGENT_DOMAIN_KB',
      confidence: 0.80,
      matchedFaqId: null,
    };
  }

  // 3. AWAIT IBM ENGINE IF LOCAL DID NOT HAVE CONFIDENT MATCH
  const ibmResult = await ibmEnginePromise;
  if (ibmResult && ibmResult.answer) {
    return ibmResult;
  }

  // 4. SECONDARY EXTERNAL FALLBACK: Google Gemini AI
  const geminiAnswer = await generateGeminiFaqAnswer(question);
  if (geminiAnswer && !isPlaceholderResponse(geminiAnswer)) {
    console.log(`[faqAgent] ✓ Dual Engine Gemini AI Fallback Output:\n"${geminiAnswer}"`);
    return {
      answer:       geminiAnswer,
      confident:    true,
      domain:       'GEMINI_AI_FALLBACK',
      confidence:   0.85,
      matchedFaqId: null,
    };
  }

  /* 
  ===================================================================
  PREVIOUS SEQUENTIAL CODE (COMMENTED OUT AS REQUESTED):
  ===================================================================
  // 1. PRIMARY: Query IBM watsonx Orchestrate Agent
  try {
    const rawWxo = await chatWithAgent(FAQ_AGENT_ID, prompt, null);
    const cleanWxo = cleanOrchestrateText(rawWxo);

    if (cleanWxo && cleanWxo.length > 15 && !isPlaceholderResponse(cleanWxo)) {
      console.log(`[faqAgent] ✓ Primary IBM watsonx Orchestrate Output:\n"${cleanWxo}"`);
      const deflectedToTeller = /teller|counter|branch staff|speak with|visit the branch/i.test(cleanWxo);
      return {
        answer:       cleanWxo,
        confident:    !deflectedToTeller,
        domain:       'IBM_WATSONX_ORCHESTRATE',
        confidence:   deflectedToTeller ? 0.05 : 0.95,
        matchedFaqId: null,
      };
    }
  } catch (err) {
    console.warn('[faqAgent] IBM watsonx Orchestrate call failed, checking secondary fallback:', err.message);
  }

  // 2. SECONDARY FALLBACK: Google Gemini AI
  const geminiAnswer = await generateGeminiFaqAnswer(question);
  if (geminiAnswer && !isPlaceholderResponse(geminiAnswer)) {
    console.log(`[faqAgent] ✓ Secondary Gemini AI Fallback Output:\n"${geminiAnswer}"`);
    return {
      answer:       geminiAnswer,
      confident:    true,
      domain:       'GEMINI_AI_FALLBACK',
      confidence:   0.85,
      matchedFaqId: null,
    };
  }

  // 3. TERTIARY FALLBACK: Local KB lookup
  const localMatch = localFaqLookup(question);
  if (localMatch.confident) {
    return localMatch;
  }

  // 4. QUATERNARY FALLBACK: Intelligent Domain Answer
  return {
    answer: intelligentDomainAnswer(question),
    confident: true,
    domain: 'INTELLIGENT_DOMAIN_KB',
    confidence: 0.80,
    matchedFaqId: null,
  };
  ===================================================================
  */

  // Default fallback if no other layer produced an answer
  return {
    answer: domainAns || 'TORII autonomous banking system provides full self-service for account inquiries, transfer clearance, and document updates.',
    confident: true,
    domain: 'INTELLIGENT_DOMAIN_KB',
    confidence: 0.80,
    matchedFaqId: null,
  };
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
