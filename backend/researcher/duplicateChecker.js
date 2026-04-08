/**
 * Duplicate Challenge Checker
 * Compares a new spec against all existing specs in the database.
 * Scoring: CVE match (50), CWE match (20), tech stack overlap (15),
 *          category+difficulty combo (10), name similarity (15)
 *
 * Score >= 60: duplicate warning (high confidence)
 * Score 40-59: similar warning (moderate confidence)
 * Score < 40: no match
 */

/**
 * Check if a new spec is too similar to existing specs.
 * @param {object} newSpec - The newly generated challenge spec
 * @param {Function} getAllSpecs - Function that returns all existing specs from DB
 * @returns {{ isDuplicate, isWarning, similarChallenges, highestScore }}
 */
export function checkDuplicate(newSpec, getAllSpecs) {
  const allSpecs = getAllSpecs();
  const results = [];

  for (const existing of allSpecs) {
    let existingData;
    try {
      existingData = typeof existing.spec_json === 'string'
        ? JSON.parse(existing.spec_json)
        : existing.spec_json;
    } catch {
      continue;
    }

    let score = 0;
    const reasons = [];

    // 1. Exact CVE match (50 points)
    if (newSpec.cveId && existingData.cveId && newSpec.cveId === existingData.cveId) {
      score += 50;
      reasons.push(`Same CVE: ${newSpec.cveId}`);
    }

    // 2. Same CWE (20 points)
    const newCwe = newSpec.cwe?.id || newSpec.cwes?.[0]?.id;
    const existCwe = existingData.cwe?.id || existingData.cwes?.[0]?.id;
    if (newCwe && existCwe && newCwe === existCwe) {
      score += 20;
      reasons.push(`Same CWE: ${newCwe}`);
    }

    // 3. Tech stack overlap (15 points if 2+ shared)
    const newStack = (newSpec.techStack || []).map((s) => s.toLowerCase());
    const existStack = (existingData.techStack || []).map((s) => s.toLowerCase());
    const stackOverlap = newStack.filter((t) => existStack.includes(t));
    if (stackOverlap.length >= 2) {
      score += 15;
      reasons.push(`Tech overlap: ${stackOverlap.join(', ')}`);
    }

    // 4. Same category + difficulty (10 points)
    if (newSpec.category === existingData.category && newSpec.difficulty === existingData.difficulty) {
      score += 10;
      reasons.push(`Same ${newSpec.category}/${newSpec.difficulty}`);
    }

    // 5. Challenge name similarity (15 points if > 60% word overlap)
    const nameScore = wordOverlapScore(newSpec.challengeName || '', existingData.challengeName || '');
    if (nameScore > 0.6) {
      score += 15;
      reasons.push(`Similar name (${Math.round(nameScore * 100)}%)`);
    }

    if (score >= 40) {
      results.push({
        jobId: existing.job_id,
        challengeName: existingData.challengeName || 'Unknown',
        category: existingData.category,
        difficulty: existingData.difficulty,
        similarityScore: score,
        reasons,
      });
    }
  }

  results.sort((a, b) => b.similarityScore - a.similarityScore);

  return {
    isDuplicate: results.length > 0 && results[0].similarityScore >= 60,
    isWarning: results.length > 0 && results[0].similarityScore >= 40,
    similarChallenges: results.slice(0, 3),
    highestScore: results[0]?.similarityScore || 0,
  };
}

/**
 * Calculate word overlap (Jaccard similarity) between two strings.
 */
export function wordOverlapScore(str1, str2) {
  if (!str1 || !str2) return 0;
  const words1 = new Set(str1.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((w) => w.length > 2));
  const words2 = new Set(str2.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((w) => w.length > 2));
  if (words1.size === 0 || words2.size === 0) return 0;
  let overlap = 0;
  for (const word of words1) {
    if (words2.has(word)) overlap++;
  }
  const union = new Set([...words1, ...words2]);
  return overlap / union.size;
}

/**
 * Quick CVE-only duplicate check for the /api/implement endpoint.
 */
export function checkCveDuplicate(cveId, findJobByCve) {
  const existing = findJobByCve(cveId);
  if (!existing) return null;
  return {
    jobId: existing.id,
    status: existing.status,
    category: existing.category,
    createdAt: existing.created_at,
  };
}
