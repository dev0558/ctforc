import { fetchCVE } from './nvdClient.js';
import { categorizeReferences } from './refCollector.js';
import { enrichContext } from './contextEnricher.js';
import { generateFromCVE, generateFromIdea } from './specGenerator.js';

/**
 * Full researcher pipeline for CVE mode:
 * 1. Fetch from NVD
 * 2. Categorize references
 * 3. Enrich context (CWE, MITRE, tech stack, difficulty)
 * 4. Generate spec via Claude API
 * 5. Return validated spec + metrics
 */
export async function researchCVE(cveId) {
  console.log(`[Researcher] Starting CVE pipeline for ${cveId}`);

  // Phase 1: Data collection (no LLM)
  const nvdData = await fetchCVE(cveId);
  console.log(`[Researcher] NVD data fetched: CVSS ${nvdData.cvss.score}, ${nvdData.cwes.length} CWEs, ${nvdData.references.length} refs`);

  const categorizedRefs = categorizeReferences(nvdData.references);
  console.log(`[Researcher] Refs: ${categorizedRefs.pocs.length} PoCs, ${categorizedRefs.advisories.length} advisories, ${categorizedRefs.writeups.length} writeups`);

  const enrichedContext = enrichContext(nvdData, categorizedRefs);
  console.log(`[Researcher] Enriched: category=${enrichedContext.detectedCategory}, difficulty=${enrichedContext.suggestedDifficulty}, stack=[${enrichedContext.techStack.join(',')}]`);

  // Phase 2: AI spec generation
  const { spec, tokenUsage, durationMs } = await generateFromCVE(enrichedContext);
  console.log(`[Researcher] Spec generated: "${spec.challengeName}" (${tokenUsage} tokens, ${durationMs}ms)`);

  return {
    spec,
    tokenUsage,
    durationMs,
    enrichedContext,
  };
}

/**
 * Full researcher pipeline for idea mode:
 * 1. Take user description, category, difficulty
 * 2. Generate spec via Claude API
 * 3. Return validated spec + metrics
 */
export async function researchIdea(ideaText, category, difficulty) {
  console.log(`[Researcher] Starting idea pipeline: "${ideaText.substring(0, 50)}..."`);

  const { spec, tokenUsage, durationMs } = await generateFromIdea(ideaText, category, difficulty);
  console.log(`[Researcher] Spec generated: "${spec.challengeName}" (${tokenUsage} tokens, ${durationMs}ms)`);

  return { spec, tokenUsage, durationMs };
}
