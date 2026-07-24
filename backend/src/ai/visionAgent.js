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
  // Check if Orchestrate is configured; fall back to simulation in dev
  if (!process.env.WATSONX_ORCHESTRATE_API_KEY || !process.env.WATSONX_ORCHESTRATE_ENDPOINT) {
    console.info('[visionAgent] Orchestrate not configured — using dev simulation');
    return _devSimulation();
  }

  const base64Image = fileBuffer.toString('base64');
  const dataUri = `data:${mimeType};base64,${base64Image}`;

  const prompt =
    'You are a PAN card OCR extractor. Analyse the provided document image and return ONLY a valid JSON object with these exact keys: ' +
    '"name" (full name as printed), "pan_number" (10-character alphanumeric PAN), ' +
    '"clarity_score" (float 0.0-1.0 representing image readability), ' +
    '"confidence" (float 0.0-1.0 representing extraction confidence). ' +
    'Return nothing else — no explanation, no markdown, just the JSON object.\n\n' +
    `Image (base64): ${dataUri.substring(0, 200)}...`;

  const fallback = _devSimulation();
  const result = await chatWithAgentJSON(VISION_AGENT_ID, prompt, fallback, {
    document_base64: base64Image,
    mime_type: mimeType,
  });

  return {
    name: result.name || 'UNKNOWN',
    pan_number: result.pan_number || null,
    confidence: Number(result.confidence ?? 0.5),
    clarity_score: Number(result.clarity_score ?? 0.5),
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

function _devSimulation() {
  return {
    name: 'MITHUN RAJ',
    pan_number: 'ABCDE1234F',
    confidence: 0.94,
    clarity_score: 0.92,
  };
}

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
