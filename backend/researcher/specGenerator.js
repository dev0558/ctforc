import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateJSON } from '../agents/claudeClient.js';
import { validateSpec } from './schemas/challengeSpec.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROMPTS_DIR = path.resolve(__dirname, '../agents/prompts');

/**
 * Generate a challenge spec from enriched CVE context.
 * Calls Claude API, validates with Zod, retries on validation failure.
 */
export async function generateFromCVE(enrichedContext) {
  const systemPrompt = fs.readFileSync(
    path.join(PROMPTS_DIR, 'researcher-cve.md'),
    'utf-8'
  );

  const userPrompt = buildCVEPrompt(enrichedContext);

  console.log(`[SpecGen] Generating spec for ${enrichedContext.cveId}...`);
  const { result, tokenUsage, durationMs } = await generateJSON({
    systemPrompt,
    userPrompt,
    maxRetries: 2,
  });

  // Validate against Zod schema
  const validation = validateSpec(result);
  if (!validation.success) {
    console.error('[SpecGen] Validation errors:', validation.errors);
    throw new Error(
      `Spec validation failed: ${validation.errors.map((e) => `${e.path}: ${e.message}`).join('; ')}`
    );
  }

  return {
    spec: validation.data,
    tokenUsage,
    durationMs,
  };
}

/**
 * Generate a challenge spec from a custom idea.
 */
export async function generateFromIdea(ideaText, category, difficulty) {
  const systemPrompt = fs.readFileSync(
    path.join(PROMPTS_DIR, 'researcher-idea.md'),
    'utf-8'
  );

  const userPrompt = `Create a CTF challenge based on this idea:

Description: ${ideaText}
Category: ${category}
Difficulty: ${difficulty}

Generate a complete challenge specification as JSON.`;

  console.log(`[SpecGen] Generating spec for idea: "${ideaText.substring(0, 50)}..."...`);
  const { result, tokenUsage, durationMs } = await generateJSON({
    systemPrompt,
    userPrompt,
    maxRetries: 2,
  });

  const validation = validateSpec(result);
  if (!validation.success) {
    console.error('[SpecGen] Validation errors:', validation.errors);
    throw new Error(
      `Spec validation failed: ${validation.errors.map((e) => `${e.path}: ${e.message}`).join('; ')}`
    );
  }

  return {
    spec: validation.data,
    tokenUsage,
    durationMs,
  };
}

/**
 * Build the user prompt for CVE mode with all enriched context
 */
function buildCVEPrompt(ctx) {
  const refSummary = [];
  if (ctx.references.pocs.length > 0) {
    refSummary.push(`Public PoCs: ${ctx.references.pocs.map((r) => r.url).join(', ')}`);
  }
  if (ctx.references.advisories.length > 0) {
    refSummary.push(`Advisories: ${ctx.references.advisories.map((r) => r.url).join(', ')}`);
  }
  if (ctx.references.writeups.length > 0) {
    refSummary.push(`Writeups: ${ctx.references.writeups.map((r) => r.url).join(', ')}`);
  }

  return `Create a CTF challenge based on this CVE:

== CVE DATA ==
CVE ID: ${ctx.cveId}
Description: ${ctx.description}
Published: ${ctx.published || 'Unknown'}

== SEVERITY ==
CVSS Score: ${ctx.cvss.score} (${ctx.cvss.severity})
Attack Vector: ${ctx.cvss.vector}
Attack Complexity: ${ctx.cvss.complexity}
Privileges Required: ${ctx.cvss.privilegesRequired || 'Unknown'}
User Interaction: ${ctx.cvss.userInteraction || 'Unknown'}

== WEAKNESS ==
${ctx.cwes.map((c) => `${c.id}: ${c.name} (${c.category})`).join('\n')}

== MITRE ATT&CK ==
Technique: ${ctx.mitre.technique} - ${ctx.mitre.name} (${ctx.mitre.tactic})

== AFFECTED PRODUCTS ==
${ctx.affected.map((a) => `${a.vendor}/${a.product} (up to ${a.versionEnd || 'unknown'})`).join('\n')}

== DETECTED TECH STACK ==
${ctx.techStack.join(', ')}

== REFERENCES ==
${refSummary.join('\n') || 'No categorized references'}
Public exploit exists: ${ctx.exploitExists ? 'YES' : 'NO'}

== SUGGESTED VALUES ==
Category: ${ctx.detectedCategory}
Difficulty: ${ctx.suggestedDifficulty}
Points: ${ctx.suggestedPoints}

Generate a complete challenge specification as JSON.`;
}
