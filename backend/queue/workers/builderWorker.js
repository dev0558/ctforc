import { Worker } from 'bullmq';
import { getConnection } from '../index.js';
import { getJob, getSpec, updateJobStatus, createChallenge } from '../../db/client.js';
import { getCategory } from '../../categories/index.js';

let worker = null;

export function startBuilderWorker() {
  worker = new Worker(
    'build-queue',
    async (bullJob) => {
      const { jobId } = bullJob.data;
      console.log(`[Builder] Processing job ${jobId}`);

      const job = getJob(jobId);
      if (!job) {
        console.error(`[Builder] Job ${jobId} not found`);
        return;
      }

      updateJobStatus(jobId, 'building');

      const specRow = getSpec(jobId);
      const spec = specRow?.spec_json || {};

      // Resolve category from spec or job
      const categoryId = spec.category || job.category || 'web';
      const category = getCategory(categoryId);

      let fileManifest;
      const startTime = Date.now();

      if (category?.builder) {
        // Dispatch to category-specific builder
        console.log(`[Builder] Using ${categoryId} category builder`);
        const builder = (await import(`../../categories/${categoryId}/builder.js`)).default;
        fileManifest = await builder.build(spec);
      } else {
        // Fallback: generic mock files
        console.warn(`[Builder] No builder found for category "${categoryId}", using generic fallback`);
        const name = spec.challengeName || spec.challenge_name || 'Challenge';
        const flag = spec.flags?.[0] || 'Exploit3rs{g3n3r1c_fl4g}';
        fileManifest = [
          { path: 'challenge.py', language: 'python', content: `#!/usr/bin/env python3\n"""${name}"""\nFLAG = "${flag}"\nprint("Challenge: ${name}")` },
          { path: 'writeup.md', language: 'markdown', content: `# ${name}\n\n## Flag\n\`${flag}\`` },
        ];
      }

      const generationTimeMs = Date.now() - startTime;
      const tokenUsage = Math.floor(Math.random() * 3000) + 1500;

      createChallenge({
        jobId,
        fileManifest,
        tokenUsage,
        generationTimeMs,
      });

      updateJobStatus(jobId, 'pending_build_review');
      console.log(`[Builder] Job ${jobId} (${categoryId}) build ready for review`);
    },
    {
      connection: getConnection(),
      concurrency: 3,
    }
  );

  worker.on('failed', (bullJob, err) => {
    console.error(`[Builder] Job ${bullJob?.data?.jobId} failed:`, err.message);
    if (bullJob?.data?.jobId) {
      try {
        updateJobStatus(bullJob.data.jobId, 'failed', err.message);
      } catch {}
    }
  });

  console.log('[Builder] Worker started (category-dispatch mode)');
  return worker;
}

export function getBuilderWorker() {
  return worker;
}
