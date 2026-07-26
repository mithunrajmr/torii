// backend/src/ai/visionAgent.js
// Vision Agent — delegates to IBM watsonx Orchestrate Vision OCR agent.
//
// The agent itself (Granite 3.2 Vision model + PAN extraction tool) is defined
// in /watsonx-orchestrate/agents/vision-agent/ and deployed via the ADK.
//
// This module is the Node.js adapter: it encodes the image to base64,
// builds the prompt, calls Orchestrate, and normalises the response.
//
// Env vars required:
//   WATSONX_ORCHESTRATE_ENDPOINT   — e.g. https://api.us-south.watson-orchestrate.cloud.ibm.com
//   WATSONX_ORCHESTRATE_API_KEY    — IBM Cloud IAM API key
//   WXO_VISION_AGENT_ID            — Orchestrate agent ID for the Vision OCR agent

import { chatWithAgentJSON } from './orchestrateClient.js';

const VISION_AGENT_ID = process.env.WXO_VISION_AGENT_ID || 'torii-vision-ocr-agent';
const CLARITY_THRESHOLD = 0.80;

/**
 * Send an image buffer to the watsonx Orchestrate Vision OCR agent.
 * Returns extracted PAN metadata with clarity and confidence scores.
 *
 * @param {Buffer} fileBuffer  - Raw image bytes
 * @param {string} mimeType    - e.g. 'image/jpeg'
 * @returns {Promise<{name: string, pan_number: string, confidence: number, clarity_score: number}>}
 */
export async function processVisionOCR(fileBuffer, mimeType) {
  const base64Image = fileBuffer.toString('base64');

  const prompt =
    'You are a PAN card OCR extractor. A document image has been provided in the context. ' +
    'Use the extract_pan_from_image tool to analyse it, then return ONLY a valid JSON object with these exact keys: ' +
    '"name" (full name as printed on card), "pan_number" (10-character PAN — 5 uppercase letters + 4 digits + 1 uppercase letter), ' +
    '"clarity_score" (float 0.0–1.0 representing image readability), ' +
    '"confidence" (float 0.0–1.0 representing extraction confidence). ' +
    'Return nothing else — no explanation, no markdown, just the JSON object.';

  // No silent fallback — if Orchestrate is not configured this throws immediately.
  // In production you will see a real error; in dev run: POST /api/dev/teller-token
  // and set WATSONX_ORCHESTRATE_API_KEY + WATSONX_ORCHESTRATE_ENDPOINT in .env.
  const result = await chatWithAgentJSON(VISION_AGENT_ID, prompt, null, {
    document_base64: base64Image,
    mime_type: mimeType,
  });

  if (!result) {
    throw new Error(
      '[visionAgent] Orchestrate returned no parseable JSON. ' +
      'Check WATSONX_ORCHESTRATE_API_KEY and WATSONX_ORCHESTRATE_ENDPOINT are set.'
    );
  }

  // Output validation: PAN must match format or be null
  const PAN_FORMAT = /^[A-Z]{5}\d{4}[A-Z]$/;
  const rawPan = result.pan_number;
  const pan_number = rawPan && PAN_FORMAT.test(String(rawPan).trim().toUpperCase())
    ? String(rawPan).trim().toUpperCase()
    : null;

  const confidence = Number(result.confidence);
  const clarity_score = Number(result.clarity_score);

  if (isNaN(confidence) || isNaN(clarity_score)) {
    throw new Error(
      `[visionAgent] Orchestrate returned invalid scores: confidence=${result.confidence}, clarity_score=${result.clarity_score}`
    );
  }

  return {
    name: result.name ? String(result.name).trim() : 'UNKNOWN',
    pan_number,
    confidence: Math.min(1, Math.max(0, confidence)),
    clarity_score: Math.min(1, Math.max(0, clarity_score)),
  };
}

/**
 * Compute Levenshtein-based name match score between extracted name and account record.
 * @param {string} extractedName
 * @param {string} recordName
 * @returns {number} 0.0–1.0
 */
export function computeNameMatchScore(extractedName, recordName) {
  if (!extractedName || !recordName) return 0;

  const s1 = extractedName.toUpperCase().trim();
  const s2 = recordName.toUpperCase().trim();

  if (s1 === s2) return 1.0;

  const distance = _levenshtein(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  return Number((1 - distance / maxLength).toFixed(2));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _levenshtein(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}
