/**
 * Architect Worker — Stage 2 of the 3-stage pipeline.
 *
 * Reads the Researcher's technical analysis and designs the CTF challenge spec.
 * Enforces CVE technology immutability — the tech stack from NVD data cannot be changed.
 * Also handles spec rework (reject with feedback → AI revision).
 */
import { Worker } from 'bullmq';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getConnection } from '../index.js';
import {
  getJob, getSpec, getAnalysis, updateJobStatus, updateSpec,
  createSpec, createSpecVersion, getAllSpecs,
} from '../../db/client.js';
import { runAgent } from '../../agents/agentRunner.js';
import { validateSpec } from '../../researcher/schemas/challengeSpec.js';
import { checkDuplicate } from '../../researcher/duplicateChecker.js';
import config from '../../config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = resolve(__dirname, '..', '..', 'agents', 'prompts');

let worker = null;

export function startArchitectWorker() {
  worker = new Worker(
    'architect-queue',
    async (bullJob) => {
      const { jobId, type, feedback } = bullJob.data;

      if (type === 'rework-spec') {
        return await handleReworkSpec(jobId, feedback);
      }

      return await handleArchitect(jobId);
    },
    {
      connection: getConnection(),
      concurrency: config.queue.researcherConcurrency,
    }
  );

  worker.on('completed', (bullJob, result) => {
    console.log(`[Architect Agent] Job ${bullJob.id} completed`);
  });

  worker.on('failed', (bullJob, err) => {
    console.error(`[Architect Agent] Job ${bullJob?.id} failed:`, err.message);
  });

  console.log('[Architect Agent] Started (stage 2: analysis → challenge spec)');
  return worker;
}

/**
 * Design a CTF challenge spec from the Researcher's analysis.
 */
async function handleArchitect(jobId) {
  console.log(`[Architect Agent] Designing spec for job ${jobId}`);

  const job = getJob(jobId);
  if (!job) throw new Error(`Job ${jobId} not found`);

  const analysis = getAnalysis(jobId);
  if (!analysis) throw new Error(`No analysis found for job ${jobId}`);

  const analysisJson = analysis.analysis_json || {};

  try {
    // Load the architect prompt
    const systemPrompt = readFileSync(resolve(PROMPTS_DIR, 'architect-spec.md'), 'utf-8');

    // Build user prompt based on mode
    let userPrompt;

    if (analysisJson.type === 'idea') {
      // Idea mode: simpler prompt
      userPrompt = buildIdeaPrompt(analysisJson, job);
    } else {
      // CVE mode: full analysis + immutable tech enforcement
      userPrompt = buildCVEArchitectPrompt(analysisJson, job);
    }

    const { result, tokenUsage, durationMs } = await runAgent({
      agentName: 'Architect',
      systemPrompt,
      userPrompt,
      maxTokens: 8192,
      jsonOutput: true,
    });

    // Validate spec against Zod schema
    const validation = validateSpec(result);
    if (!validation.success) {
      throw new Error(
        `Spec validation failed: ${validation.errors.map((e) => `${e.path}: ${e.message}`).join('; ')}`
      );
    }

    const spec = validation.data;

    // Enforce CVE tech immutability
    if (analysisJson.type !== 'idea' && job.immutable_tech) {
      const immutableTech = typeof job.immutable_tech === 'string'
        ? JSON.parse(job.immutable_tech) : job.immutable_tech;
      enforceImmutableTech(spec, immutableTech);
    }

    // Duplicate check
    const dupResult = checkDuplicate(spec, () => getAllSpecs());
    if (dupResult.isDuplicate) {
      console.warn(`[Architect Agent] ${jobId} DUPLICATE detected (score: ${dupResult.highestScore})`);
      spec.duplicateWarning = {
        isDuplicate: true,
        highestScore: dupResult.highestScore,
        similarChallenges: dupResult.similarChallenges,
      };
    } else if (dupResult.isWarning) {
      spec.duplicateWarning = {
        isDuplicate: false,
        highestScore: dupResult.highestScore,
        similarChallenges: dupResult.similarChallenges,
      };
    }

    // Save spec
    createSpec({ jobId, specJson: spec, tokenUsage, generationTimeMs: durationMs });
    createSpecVersion({ jobId, revision: 1, specJson: spec, tokenUsage });

    updateJobStatus(jobId, 'pending_spec_review');

    console.log(`[Architect Agent] ${jobId} spec: "${spec.challengeName}" | ${tokenUsage} tokens`);
    return { jobId, status: 'pending_spec_review', challengeName: spec.challengeName };
  } catch (err) {
    console.error(`[Architect Agent] ${jobId} error:`, err.message);
    updateJobStatus(jobId, 'failed', `Architect failed: ${err.message}`);
    throw err;
  }
}

/**
 * Handle spec rework — load rejected spec + feedback, call Claude to revise.
 */
async function handleReworkSpec(jobId, feedback) {
  console.log(`[Architect Agent] Reworking spec for job ${jobId}`);

  const job = getJob(jobId);
  if (!job) throw new Error(`Job ${jobId} not found`);

  const specRow = getSpec(jobId);
  if (!specRow) throw new Error(`No spec found for job ${jobId}`);

  const existingSpec = typeof specRow.spec_json === 'string'
    ? JSON.parse(specRow.spec_json) : specRow.spec_json;

  const promptPath = resolve(PROMPTS_DIR, 'rework-spec.md');
  let systemPrompt;
  try {
    systemPrompt = readFileSync(promptPath, 'utf-8');
  } catch {
    throw new Error('rework-spec.md prompt not found');
  }

  // Include immutable tech constraint for CVE-based challenges
  let immutableNote = '';
  if (job.immutable_tech) {
    const immutableTech = typeof job.immutable_tech === 'string'
      ? JSON.parse(job.immutable_tech) : job.immutable_tech;
    immutableNote = `\n\n== IMMUTABLE TECHNOLOGY (DO NOT CHANGE) ==\nThe technology stack is locked because this challenge is based on a CVE tied to specific software:\n${JSON.stringify(immutableTech, null, 2)}\nDo NOT substitute or change these technologies in your revision.`;
  }

  const userPrompt = [
    `== ORIGINAL SPEC (REJECTED) ==`,
    JSON.stringify(existingSpec, null, 2),
    ``,
    `== REVIEWER FEEDBACK ==`,
    feedback,
    ``,
    `== REVISION NUMBER ==`,
    `This is revision ${job.spec_revision || 2} of 3. Address ALL feedback points.`,
    immutableNote,
  ].join('\n');

  try {
    const { result, tokenUsage, durationMs } = await runAgent({
      agentName: 'Architect (Rework)',
      systemPrompt,
      userPrompt,
      maxTokens: 8192,
      jsonOutput: true,
    });

    // Enforce immutability again after rework
    if (job.immutable_tech) {
      const immutableTech = typeof job.immutable_tech === 'string'
        ? JSON.parse(job.immutable_tech) : job.immutable_tech;
      enforceImmutableTech(result, immutableTech);
    }

    updateSpec(jobId, result, tokenUsage, durationMs);
    createSpecVersion({ jobId, revision: job.spec_revision || 2, specJson: result, feedback, tokenUsage });
    updateJobStatus(jobId, 'pending_spec_review');

    console.log(`[Architect Agent] ${jobId} rework complete (rev ${job.spec_revision}) | ${tokenUsage} tokens`);
    return { jobId, status: 'pending_spec_review', revision: job.spec_revision };
  } catch (err) {
    console.error(`[Architect Agent] ${jobId} rework failed:`, err.message);
    updateJobStatus(jobId, 'failed', `Spec rework failed: ${err.message}`);
    throw err;
  }
}

/**
 * Enforce that the spec's tech stack includes the immutable technologies from NVD.
 * If the architect tried to change them, force them back.
 */
function enforceImmutableTech(spec, immutableTech) {
  if (!immutableTech || !immutableTech.techStack) return;

  const required = immutableTech.techStack;
  const current = spec.techStack || [];
  const currentLower = current.map((t) => t.toLowerCase());

  for (const tech of required) {
    if (!currentLower.includes(tech.toLowerCase())) {
      spec.techStack.push(tech);
      console.log(`[Architect Agent] Enforced immutable tech: ${tech}`);
    }
  }

  // Preserve language/framework from analysis
  if (immutableTech.language && !current.some((t) => t.toLowerCase() === immutableTech.language.toLowerCase())) {
    spec.techStack.push(immutableTech.language);
  }
  if (immutableTech.framework && !current.some((t) => t.toLowerCase() === immutableTech.framework.toLowerCase())) {
    spec.techStack.push(immutableTech.framework);
  }
}

/**
 * Build prompt for CVE-based challenge design.
 */
function buildCVEArchitectPrompt(analysis, job) {
  return `Design a CTF challenge based on this technical analysis from the Researcher Agent:

== TECHNICAL ANALYSIS ==
${JSON.stringify(analysis, null, 2)}

== IMMUTABLE TECHNOLOGY CONSTRAINT ==
This CVE is tied to specific technology. The tech stack MUST include: ${(analysis.affectedTechnology?.techStack || []).join(', ')}
${analysis.affectedTechnology?.language ? `Primary language: ${analysis.affectedTechnology.language}` : ''}
${analysis.affectedTechnology?.framework ? `Framework: ${analysis.affectedTechnology.framework}` : ''}
DO NOT substitute these technologies with alternatives (e.g., do NOT replace Java/Struts with Python/Flask).

== HONEYPOT PREFERENCE ==
${job.honeypot_flag === null ? 'Honeypot flag is DISABLED. Set honeypotFlag to null.' : job.honeypot_flag ? `Use this exact honeypot flag: ${job.honeypot_flag}` : 'Generate a honeypot flag automatically.'}

Design a complete challenge specification as JSON.`;
}

/**
 * Build prompt for idea-based challenge design.
 */
function buildIdeaPrompt(analysis, job) {
  return `Design a CTF challenge based on this custom idea:

Description: ${analysis.ideaText || job.idea_text}
Category: ${analysis.category || job.category}
Difficulty: ${analysis.difficulty || job.difficulty}

== HONEYPOT PREFERENCE ==
${job.honeypot_flag === null ? 'Honeypot flag is DISABLED. Set honeypotFlag to null.' : job.honeypot_flag ? `Use this exact honeypot flag: ${job.honeypot_flag}` : 'Generate a honeypot flag automatically.'}

Design a complete challenge specification as JSON.`;
}

export function getArchitectWorker() {
  return worker;
}
