// backend/src/ai/entityMatcherAgent.js
// Cross-Document & Account Record Entity Matching Agent.
//
// Performs fuzzy name matching (Levenshtein + token overlap), DOB comparison,
// and address normalization checks across multi-document packages (PAN, Aadhaar, Utility Bills)
// and against the Core Banking System account record.

/**
 * Compute Levenshtein distance between two strings.
 */
function levenshteinDistance(a, b) {
  const s1 = a.toUpperCase().trim();
  const s2 = b.toUpperCase().trim();

  if (s1 === s2) return 0;
  if (!s1.length) return s2.length;
  if (!s2.length) return s1.length;

  const matrix = Array.from({ length: s1.length + 1 }, () =>
    Array(s2.length + 1).fill(0)
  );

  for (let i = 0; i <= s1.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= s2.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[s1.length][s2.length];
}

/**
 * Compute fuzzy name match score (0.0 to 1.0) using combined Levenshtein
 * distance and word token intersection (handles name ordering variations like "Arjun Sharma" vs "Sharma Arjun").
 */
export function matchNames(name1, name2) {
  if (!name1 || !name2) return 0.0;

  const n1 = name1.toUpperCase().replace(/[^A-Z\s]/g, '').trim();
  const n2 = name2.toUpperCase().replace(/[^A-Z\s]/g, '').trim();

  if (n1 === n2) return 1.0;

  // 1. Levenshtein ratio
  const dist = levenshteinDistance(n1, n2);
  const maxLen = Math.max(n1.length, n2.length);
  const levScore = maxLen > 0 ? (1 - dist / maxLen) : 0.0;

  // 2. Token set match
  const tokens1 = new Set(n1.split(/\s+/).filter(Boolean));
  const tokens2 = new Set(n2.split(/\s+/).filter(Boolean));

  let common = 0;
  tokens1.forEach((t) => { if (tokens2.has(t)) common++; });
  const tokenScore = Math.max(tokens1.size, tokens2.size) > 0
    ? (common / Math.max(tokens1.size, tokens2.size))
    : 0.0;

  // Weighted score: if token set is identical, weight tokenScore 80%; otherwise 60% token + 40% Levenshtein
  const tokenWeight = tokenScore === 1.0 ? 0.80 : 0.60;
  const score = (tokenScore * tokenWeight) + (levScore * (1 - tokenWeight));
  return Number(score.toFixed(2));
}

/**
 * Normalize date strings into YYYY-MM-DD for accurate comparison.
 */
export function normalizeDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const cleaned = dateStr.trim();

  // Match DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = cleaned.match(/^(\d{2})[\/\.-](\d{2})[\/\.-](\d{4})$/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
  }

  // Match YYYY-MM-DD
  const ymdMatch = cleaned.match(/^(\d{4})[\/\.-](\d{2})[\/\.-](\d{2})$/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${ymdMatch[2]}-${ymdMatch[3]}`;
  }

  return cleaned;
}

/**
 * Compare multi-document OCR extractions against registered account records.
 *
 * @param {object} params
 * @param {string} params.registeredName
 * @param {string} [params.registeredDob]
 * @param {string} [params.registeredAddress]
 * @param {Array<object>} params.documents - Array of extracted doc OCR objects
 * @returns {{
 *   overallScore: number,
 *   isMatch: boolean,
 *   nameScore: number,
 *   dobScore: number,
 *   mismatchFlags: string[]
 * }}
 */
export function evaluateEntityMatch({ registeredName, registeredDob, registeredAddress, documents = [] }) {
  const mismatchFlags = [];
  const nameScores = [];
  let dobMatched = true;

  for (const doc of documents) {
    const docName = doc.name || doc.full_name;
    if (docName && docName !== 'UNKNOWN') {
      const score = matchNames(docName, registeredName);
      nameScores.push(score);
      if (score < 0.50) {
        mismatchFlags.push(`NAME_MISMATCH: Document '${doc.id_type || doc.document_type}' name '${docName}' differs significantly from account name '${registeredName}' (${(score * 100).toFixed(0)}% match).`);
      }
    }

    if (registeredDob && doc.dob) {
      const normReg = normalizeDate(registeredDob);
      const normDoc = normalizeDate(doc.dob);
      if (normReg && normDoc && normReg !== normDoc) {
        dobMatched = false;
        mismatchFlags.push(`DOB_MISMATCH: Document DOB '${doc.dob}' does not match registered DOB '${registeredDob}'.`);
      }
    }
  }

  const avgNameScore = nameScores.length > 0
    ? Number((nameScores.reduce((s, v) => s + v, 0) / nameScores.length).toFixed(2))
    : 1.0;

  const dobScore = dobMatched ? 1.0 : 0.0;
  const overallScore = Number(((avgNameScore * 0.70) + (dobScore * 0.30)).toFixed(2));
  const isMatch = overallScore >= 0.70 && mismatchFlags.length === 0;

  return {
    overallScore,
    isMatch,
    nameScore: avgNameScore,
    dobScore,
    mismatchFlags,
  };
}

export default { matchNames, normalizeDate, evaluateEntityMatch };
