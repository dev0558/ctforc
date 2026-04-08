import { Worker } from 'bullmq';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getConnection } from '../index.js';
import { getJob, getSpec, updateJobStatus, updateSpec, createSpec, createSpecVersion } from '../../db/client.js';
import { researchCVE, researchIdea } from '../../researcher/index.js';
import { checkDuplicate, checkCveDuplicate } from '../../researcher/duplicateChecker.js';
import { getAllSpecs, findJobByCveId } from '../../db/client.js';
import { generateJSON } from '../../agents/claudeClient.js';
import config from '../../config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = resolve(__dirname, '..', '..', 'agents', 'prompts');

let worker = null;

export function startResearcherWorker() {
  worker = new Worker(
    'research-queue',
    async (bullJob) => {
      const { jobId, type, feedback } = bullJob.data;

      if (type === 'rework-spec') {
        return await handleReworkSpec(jobId, feedback);
      }

      return await handleResearch(jobId);
    },
    {
      connection: getConnection(),
      concurrency: config.queue.researcherConcurrency,
    }
  );

  worker.on('completed', (bullJob, result) => {
    console.log(`[Researcher Worker] Job ${bullJob.id} completed successfully`);
  });

  worker.on('failed', (bullJob, err) => {
    console.error(`[Researcher Worker] Job ${bullJob?.id} failed:`, err.message);
  });

  console.log('[Researcher Worker] Started (Phase 2: real Claude API + rework support)');
  return worker;
}

/**
 * Handle normal research jobs (CVE or idea).
 */
async function handleResearch(jobId) {
  console.log(`[Researcher Worker] Processing job ${jobId}`);

  const job = getJob(jobId);
  if (!job) {
    console.error(`[Researcher Worker] Job ${jobId} not found`);
    return;
  }

  const label = job.cve_id || `idea: "${(job.idea_text || '').substring(0, 40)}"`;
  console.log(`[Researcher Worker] ${jobId} | ${label}`);

  updateJobStatus(jobId, 'researching');

  try {
    let result;

    if (job.cve_id) {
      result = await researchCVE(job.cve_id);
    } else if (job.idea_text) {
      result = await researchIdea(
        job.idea_text,
        job.category || 'web',
        job.difficulty || 'medium'
      );
    } else {
      throw new Error(`Invalid job data: no cve_id or idea_text`);
    }

    // Run duplicate check after spec generation
    const dupResult = checkDuplicate(result.spec, () => getAllSpecs());

    if (dupResult.isDuplicate) {
      console.warn(`[Researcher Worker] ${jobId} DUPLICATE detected (score: ${dupResult.highestScore})`);
      // Still save the spec but attach duplicate warning
      result.spec.duplicateWarning = {
        isDuplicate: true,
        highestScore: dupResult.highestScore,
        similarChallenges: dupResult.similarChallenges,
      };
    } else if (dupResult.isWarning) {
      console.log(`[Researcher Worker] ${jobId} similar challenge found (score: ${dupResult.highestScore})`);
      result.spec.duplicateWarning = {
        isDuplicate: false,
        highestScore: dupResult.highestScore,
        similarChallenges: dupResult.similarChallenges,
      };
    }

    // Save spec to database
    createSpec({
      jobId,
      specJson: result.spec,
      tokenUsage: result.tokenUsage,
      generationTimeMs: result.durationMs,
    });

    // Save version 1
    createSpecVersion({ jobId, revision: 1, specJson: result.spec, tokenUsage: result.tokenUsage });

    updateJobStatus(jobId, 'pending_spec_review');

    console.log(`[Researcher Worker] ${jobId} complete: "${result.spec.challengeName}" | ${result.tokenUsage} tokens`);
    return { jobId, status: 'pending_spec_review', challengeName: result.spec.challengeName };
  } catch (err) {
    console.error(`[Researcher Worker] ${jobId} error:`, err.message);

    const currentJob = getJob(jobId);
    const retryCount = (currentJob?.retry_count || 0) + 1;

    if (retryCount >= config.queue.researcherMaxRetries) {
      updateJobStatus(jobId, 'failed', err.message);
    } else {
      const { getDb } = await import('../../db/client.js');
      getDb().run(
        `UPDATE jobs SET error_message = ?, retry_count = ?, updated_at = datetime('now') WHERE id = ?`,
        [err.message, retryCount, jobId]
      );
    }

    throw err;
  }
}

/**
 * Handle spec rework jobs — load rejected spec + feedback, call Claude to revise.
 */
async function handleReworkSpec(jobId, feedback) {
  console.log(`[Researcher Worker] Reworking spec for job ${jobId}`);

  const job = getJob(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  const specRow = getSpec(jobId);
  if (!specRow) {
    throw new Error(`No spec found for job ${jobId}`);
  }

  const existingSpec = typeof specRow.spec_json === 'string'
    ? JSON.parse(specRow.spec_json)
    : specRow.spec_json;

  // Load rework-spec prompt
  const promptPath = resolve(PROMPTS_DIR, 'rework-spec.md');
  let systemPrompt;
  try {
    systemPrompt = readFileSync(promptPath, 'utf-8');
  } catch {
    throw new Error('rework-spec.md prompt not found');
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
  ].join('\n');

  try {
    const { result, tokenUsage, durationMs } = await generateJSON({
      systemPrompt,
      userPrompt,
      maxRetries: 2,
      maxTokens: 8192,
    });

    // Update existing spec with revised version
    updateSpec(jobId, result, tokenUsage, durationMs);
    // Save version history
    createSpecVersion({ jobId, revision: job.spec_revision || 2, specJson: result, feedback, tokenUsage });
    updateJobStatus(jobId, 'pending_spec_review');

    console.log(`[Researcher Worker] ${jobId} spec rework complete (rev ${job.spec_revision}) | ${tokenUsage} tokens`);
    return { jobId, status: 'pending_spec_review', revision: job.spec_revision };
  } catch (err) {
    console.error(`[Researcher Worker] ${jobId} spec rework failed:`, err.message);
    updateJobStatus(jobId, 'failed', `Spec rework failed: ${err.message}`);
    throw err;
  }
}

export function getResearcherWorker() {
  return worker;
}
