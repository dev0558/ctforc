import { Worker } from 'bullmq';
import { getConnection } from '../index.js';
import { getJob, getSpec, updateJobStatus, createChallenge } from '../../db/client.js';
import { getCategory } from '../../categories/index.js';
import { buildChallenge, saveFiles } from '../../categories/baseBuilder.js';
import config from '../../config.js';

let worker = null;

export function startBuilderWorker() {
  worker = new Worker(
    'build-queue',
    async (bullJob) => {
      const { jobId } = bullJob.data;
      console.log(`[Builder Worker] Processing ${jobId}`);

      // Get the job and its approved spec
      const job = getJob(jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      const specRow = getSpec(jobId);
      if (!specRow) {
        throw new Error(`No spec found for job ${jobId}`);
      }

      // Parse the approved spec
      let approvedSpec;
      try {
        approvedSpec = typeof specRow.spec_json === 'string'
          ? JSON.parse(specRow.spec_json)
          : specRow.spec_json;
      } catch (err) {
        throw new Error(`Failed to parse spec JSON for job ${jobId}: ${err.message}`);
      }

      const categoryId = approvedSpec.category || job.category || 'web';
      const category = getCategory(categoryId);

      if (!category) {
        throw new Error(`Unknown category: ${categoryId}`);
      }

      console.log(`[Builder Worker] Category: ${categoryId} | Challenge: "${approvedSpec.challengeName}"`);

      // Update status to building
      updateJobStatus(jobId, 'building');

      try {
        // Call the real builder via Claude API using baseBuilder
        const result = await buildChallenge(approvedSpec, categoryId);

        // Save files to storage on disk
        saveFiles(jobId, result.files);

        // Convert files object to file_manifest array format for DB compatibility
        const fileManifest = result.fileList.map((filePath) => ({
          path: filePath,
          language: detectLanguage(filePath),
          content: result.files[filePath],
        }));

        // Save challenge record to database
        createChallenge({
          jobId,
          fileManifest,
          tokenUsage: result.tokenUsage,
          generationTimeMs: result.durationMs,
        });

        // Update job status
        updateJobStatus(jobId, 'pending_build_review');

        console.log(`[Builder Worker] ${jobId} complete: ${result.fileList.length} files | ${result.tokenUsage} tokens | ${result.durationMs}ms`);
        return { jobId, status: 'pending_build_review', filesCount: result.fileList.length };
      } catch (err) {
        console.error(`[Builder Worker] ${jobId} build error:`, err.message);
        updateJobStatus(jobId, 'failed', `Build failed: ${err.message}`);
        throw err;
      }
    },
    {
      connection: getConnection(),
      concurrency: config.queue.builderConcurrency || 2,
    }
  );

  worker.on('completed', (bullJob, result) => {
    console.log(`[Builder Worker] BullMQ job ${bullJob.id} completed: ${result?.filesCount} files`);
  });

  worker.on('failed', (bullJob, err) => {
    console.error(`[Builder Worker] BullMQ job ${bullJob?.id} failed:`, err.message);
  });

  console.log('[Builder Worker] Started (Phase 3: real Claude API builders)');
  return worker;
}

export function getBuilderWorker() {
  return worker;
}

/**
 * Detect language from file path for syntax highlighting.
 */
function detectLanguage(filePath) {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const map = {
    py: 'python', js: 'javascript', jsx: 'jsx', ts: 'typescript',
    c: 'c', cpp: 'cpp', h: 'c', java: 'java', rb: 'ruby', php: 'php',
    html: 'html', css: 'css', sql: 'sql', sh: 'bash', bash: 'bash',
    yml: 'yaml', yaml: 'yaml', json: 'json', md: 'markdown',
    txt: 'text', dockerfile: 'dockerfile', conf: 'text', cfg: 'text',
    pem: 'text', key: 'text',
  };
  // Handle "Dockerfile" (no extension)
  if (filePath.toLowerCase().endsWith('dockerfile')) return 'dockerfile';
  if (filePath.toLowerCase().endsWith('makefile')) return 'makefile';
  return map[ext] || 'text';
}
