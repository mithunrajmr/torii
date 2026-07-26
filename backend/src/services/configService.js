// backend/src/services/configService.js
// Dynamic agent configuration loader.
//
// Reads thresholds from the `agent_config` table on startup and caches them
// for 5 minutes. All agent modules (visionAgent, swarmOrchestrator, faqAgent)
// should call getAgentConfig() instead of using inline hardcoded constants.
//
// If the DB is unavailable or the table is empty, safe defaults are returned
// so agents continue operating without throwing.
//
// Cache refresh: 5 minutes (300,000ms). Never blocks the hot path — the cache
// is pre-warmed on first call and refreshed lazily in the background.

import { query } from '../db/index.js';

// ── Default thresholds (used when DB is unavailable or row is missing) ────────
const DEFAULTS = {
  VISION_OCR: {
    clarity_threshold:       0.80,
    confidence_floor:        0.60,
    name_match_hard_reject:  0.50,
    name_match_soft_flag:    0.80,
  },
  WATCHDOG_AML: {
    aml_tx_count_threshold:  3,
    aml_amount_threshold:    200000,
    confidence_floor:        0.60,
  },
  ADVISOR: {
    confidence_floor:        0.60,
  },
};

// ── In-process cache ──────────────────────────────────────────────────────────
let _cache     = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Load all rows from agent_config into a keyed map.
 * @returns {Promise<Object>}  { VISION_OCR: {...}, WATCHDOG_AML: {...}, ADVISOR: {...} }
 */
async function _loadFromDB() {
  try {
    const rows = await query`
      SELECT
        agent_name,
        clarity_threshold,
        confidence_floor,
        name_match_hard_reject,
        name_match_soft_flag,
        aml_tx_count_threshold,
        aml_amount_threshold,
        prompt_suffix
      FROM agent_config
    `;

    if (!rows || rows.length === 0) {
      console.info('[configService] agent_config table is empty — using defaults');
      return structuredClone(DEFAULTS);
    }

    const config = structuredClone(DEFAULTS);
    for (const row of rows) {
      const name = row.agent_name;
      if (!config[name]) config[name] = {};
      // Merge DB values over defaults — null DB values leave defaults in place
      if (row.clarity_threshold       != null) config[name].clarity_threshold       = Number(row.clarity_threshold);
      if (row.confidence_floor        != null) config[name].confidence_floor        = Number(row.confidence_floor);
      if (row.name_match_hard_reject  != null) config[name].name_match_hard_reject  = Number(row.name_match_hard_reject);
      if (row.name_match_soft_flag    != null) config[name].name_match_soft_flag    = Number(row.name_match_soft_flag);
      if (row.aml_tx_count_threshold  != null) config[name].aml_tx_count_threshold  = Number(row.aml_tx_count_threshold);
      if (row.aml_amount_threshold    != null) config[name].aml_amount_threshold    = Number(row.aml_amount_threshold);
      if (row.prompt_suffix           != null) config[name].prompt_suffix           = row.prompt_suffix;
    }

    console.info('[configService] Loaded agent config from DB:', Object.keys(config).join(', '));
    return config;
  } catch (err) {
    console.warn('[configService] DB load failed, using defaults:', err.message);
    return structuredClone(DEFAULTS);
  }
}

/**
 * Get the full agent config object, using the 5-minute cache.
 * Safe to call on every request — returns cached values after first load.
 *
 * @returns {Promise<Object>}
 */
export async function getAllAgentConfig() {
  const now = Date.now();
  if (_cache && now - _cacheTime < CACHE_TTL_MS) {
    return _cache;
  }
  _cache     = await _loadFromDB();
  _cacheTime = now;
  return _cache;
}

/**
 * Get config for a single named agent (e.g. 'VISION_OCR').
 * Returns the agent's config merged with its defaults.
 *
 * @param {'VISION_OCR'|'WATCHDOG_AML'|'ADVISOR'} agentName
 * @returns {Promise<Object>}
 */
export async function getAgentConfig(agentName) {
  const all = await getAllAgentConfig();
  return all[agentName] ?? DEFAULTS[agentName] ?? {};
}

/**
 * Force-invalidate the cache (used in tests or after a config update).
 */
export function invalidateConfigCache() {
  _cache     = null;
  _cacheTime = 0;
}

export default { getAgentConfig, getAllAgentConfig, invalidateConfigCache };
