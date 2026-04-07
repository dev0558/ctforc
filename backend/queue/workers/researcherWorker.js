import { Worker } from 'bullmq';
import { getConnection } from '../index.js';
import { getJob, updateJobStatus, createSpec } from '../../db/client.js';
import { researchCVE, researchIdea } from '../../researcher/index.js';
import config from '../../config.js';

let worker = null;

export function startResearcherWorker() {
  worker = new Worker(
    'research-queue',
    async (bullJob) => {
      const { jobId } = bullJob.data;
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

        // Save spec to database
        createSpec({
          jobId,
          specJson: result.spec,
          tokenUsage: result.tokenUsage,
          generationTimeMs: result.durationMs,
        });

        // Update job status and category if CVE research detected a different one
        updateJobStatus(jobId, 'pending_spec_review');

        console.log(`[Researcher Worker] ${jobId} complete: "${result.spec.challengeName}" | ${result.tokenUsage} tokens`);
        return { jobId, status: 'pending_spec_review', challengeName: result.spec.challengeName };
      } catch (err) {
        console.error(`[Researcher Worker] ${jobId} error:`, err.message);

        // Update retry count
        const currentJob = getJob(jobId);
        const retryCount = (currentJob?.retry_count || 0) + 1;

        if (retryCount >= config.queue.researcherMaxRetries) {
          updateJobStatus(jobId, 'failed', err.message);
        } else {
          // Keep in researching state, update error and retry count
          const { getDb } = await import('../../db/client.js');
          getDb().run(
            `UPDATE jobs SET error_message = ?, retry_count = ?, updated_at = datetime('now') WHERE id = ?`,
            [err.message, retryCount, jobId]
          );
        }

        throw err; // Let BullMQ handle retry
      }
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

  console.log('[Researcher Worker] Started (Phase 2: real Claude API)');
  return worker;
}

export function getResearcherWorker() {
  return worker;
}
