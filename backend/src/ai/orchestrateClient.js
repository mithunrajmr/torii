// backend/src/ai/orchestrateClient.js
// IBM watsonx Orchestrate REST client.
//
// Handles:
//   1. IAM token exchange  — POST https://iam.cloud.ibm.com/identity/token
//   2. Agent chat calls    — POST https://{endpoint}/v1/orchestrate/{agent_id}/chat/completions
//
// All AI agent calls in this project route through this module.
// The token is cached in-module and refreshed before expiry (55-min window).
// Never store the raw API key anywhere except the WATSONX_ORCHESTRATE_API_KEY env var.

const IAM_TOKEN_URL = 'https://iam.cloud.ibm.com/identity/token';

// Token cache — module-level is acceptable here because tokens are not
// user-specific; they authenticate the *service*, not the customer.
let _cachedToken = null;
let _tokenExpiresAt = 0; // Unix ms timestamp

/**
 * Exchange the IBM Cloud IAM API key for a short-lived Bearer token.
 * Tokens are valid for 1 hour; we refresh at 55 minutes to be safe.
 * @returns {Promise<string>} Bearer token string
 */
async function getIAMToken() {
  const now = Date.now();
  if (_cachedToken && now < _tokenExpiresAt) {
    return _cachedToken;
  }

  const apiKey = process.env.WATSONX_ORCHESTRATE_API_KEY;
  if (!apiKey) {
    throw new Error(
      '[orchestrateClient] WATSONX_ORCHESTRATE_API_KEY is not set. ' +
      'Add it to your .env file. Get it from IBM Cloud > Manage > Access (IAM) > API keys.'
    );
  }

  const body = new URLSearchParams({
    grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
    apikey: apiKey,
  });

  const res = await fetch(IAM_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[orchestrateClient] IAM token exchange failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  _cachedToken = data.access_token;
  // IBM IAM tokens last 3600s; refresh 5 minutes early
  _tokenExpiresAt = now + (data.expires_in - 300) * 1000;

  return _cachedToken;
}

/**
 * Send a single-turn message to an Orchestrate agent and return the text reply.
 *
 * @param {string} agentId   - The Orchestrate agent ID (from env vars)
 * @param {string} userMsg   - Plain-text or structured prompt to send
 * @param {object} [context] - Optional context object forwarded to the agent
 * @returns {Promise<string>} The agent's text response
 */
export async function chatWithAgent(agentId, userMsg, context = {}) {
  const endpoint = process.env.WATSONX_ORCHESTRATE_ENDPOINT;
  if (!endpoint) {
    throw new Error(
      '[orchestrateClient] WATSONX_ORCHESTRATE_ENDPOINT is not set. ' +
      'Set it to your IBM Cloud watsonx Orchestrate instance URL, ' +
      'e.g. https://api.us-south.watson-orchestrate.cloud.ibm.com'
    );
  }

  const token = await getIAMToken();
  const url = `${endpoint}/v1/orchestrate/${agentId}/chat/completions`;

  const payload = {
    messages: [
      {
        role: 'user',
        content: userMsg,
      },
    ],
    context,
    stream: false,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `[orchestrateClient] Agent call failed for ${agentId} (${res.status}): ${text}`
    );
  }

  const data = await res.json();

  // Orchestrate returns OpenAI-compatible response shape
  const choice = data.choices?.[0];
  const content = choice?.message?.content ?? choice?.text ?? '';
  return typeof content === 'string' ? content : JSON.stringify(content);
}

/**
 * Call an Orchestrate agent and parse its response as JSON.
 * The agent MUST be prompted to return valid JSON only.
 * Falls back gracefully to a default value if parsing fails.
 *
 * @param {string} agentId
 * @param {string} userMsg
 * @param {*} fallback - value returned if agent response is not valid JSON
 * @param {object} [context]
 * @returns {Promise<*>}
 */
export async function chatWithAgentJSON(agentId, userMsg, fallback, context = {}) {
  try {
    const text = await chatWithAgent(agentId, userMsg, context);
    // Strip markdown code fences if the model wraps output in ```json ... ```
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.warn(`[orchestrateClient] JSON parse failed for agent ${agentId}:`, err.message);
    return fallback;
  }
}

export default { chatWithAgent, chatWithAgentJSON };
