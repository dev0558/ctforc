import { Worker } from 'bullmq';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getConnection } from '../index.js';
import { getJob, getSpec, getChallenge, updateJobStatus, updateChallenge, createChallenge, createBuildVersion } from '../../db/client.js';
import { getCategory } from '../../categories/index.js';
import { buildChallenge, saveFiles } from '../../categories/baseBuilder.js';
import { generateJSON } from '../../agents/claudeClient.js';
import { injectCountermeasures } from '../../antiAi/engine.js';
import { testChallenge } from '../../tester/index.js';
import config from '../../config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = resolve(__dirname, '..', '..', 'agents', 'prompts');

let worker = null;

export function startBuilderWorker() {
  worker = new Worker(
    'developer-queue',
    async (bullJob) => {
      const { jobId, type, feedback } = bullJob.data;

      if (type === 'rework-build') {
        return await handleReworkBuild(jobId, feedback);
      }

      return await handleBuild(jobId);
    },
    {
      connection: getConnection(),
      concurrency: config.queue.builderConcurrency || 2,
    }
  );

  worker.on('completed', (bullJob, result) => {
    console.log(`[Developer Agent] BullMQ job ${bullJob.id} completed: ${result?.filesCount || 0} files`);
  });

  worker.on('failed', (bullJob, err) => {
    console.error(`[Developer Agent] BullMQ job ${bullJob?.id} failed:`, err.message);
  });

  console.log('[Developer Agent] Started (stage 3: spec → challenge files)');
  return worker;
}

/**
 * Handle normal build jobs.
 */
async function handleBuild(jobId) {
  console.log(`[Developer Agent] Processing ${jobId}`);

  const job = getJob(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  const specRow = getSpec(jobId);
  if (!specRow) {
    throw new Error(`No spec found for job ${jobId}`);
  }

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

  console.log(`[Developer Agent] Category: ${categoryId} | Challenge: "${approvedSpec.challengeName}"`);

  updateJobStatus(jobId, 'developing');

  try {
    const result = await buildChallenge(approvedSpec, categoryId);

    // Run Anti-AI countermeasure engine
    const realFlag = approvedSpec.flag || 'Exploit3rs{default_flag}';
    const honeypotFlag = approvedSpec.honeypotFlag || null;
    let finalFiles = result.files;
    let antiAiManifest = null;

    try {
      const antiAiResult = injectCountermeasures(result.files, honeypotFlag, realFlag);
      finalFiles = antiAiResult.processedFiles;
      antiAiManifest = antiAiResult.manifest;
      console.log(`[Developer Agent] ${jobId} anti-AI: ${antiAiManifest.totalInjections} injections (honeypot: ${honeypotFlag ? 'enabled' : 'disabled'})`);
    } catch (err) {
      console.warn(`[Developer Agent] ${jobId} anti-AI engine failed (non-fatal):`, err.message);
    }

    // Save files to storage on disk
    saveFiles(jobId, finalFiles);

    // Run challenge tester
    let testResults = null;
    try {
      testResults = await testChallenge(jobId, categoryId, finalFiles, realFlag, config.storagePath);
      console.log(`[Developer Agent] ${jobId} test: ${testResults.overallPass ? 'PASS' : 'FAIL'} (${testResults.duration}ms)`);
    } catch (err) {
      console.warn(`[Developer Agent] ${jobId} tester failed (non-fatal):`, err.message);
      testResults = { tested: false, errors: [err.message], overallPass: false };
    }

    // Convert files object to file_manifest array format for DB
    const fileList = Object.keys(finalFiles);
    const fileManifest = fileList.map((filePath) => ({
      path: filePath,
      language: detectLanguage(filePath),
      content: finalFiles[filePath],
    }));

    createChallenge({
      jobId,
      fileManifest,
      tokenUsage: result.tokenUsage,
      generationTimeMs: result.durationMs,
      antiAiManifest,
      testResults,
    });

    // Save build version 1
    createBuildVersion({ jobId, revision: 1, fileManifest, tokenUsage: result.tokenUsage });

    updateJobStatus(jobId, 'pending_build_review');

    console.log(`[Developer Agent] ${jobId} complete: ${fileList.length} files | ${result.tokenUsage} tokens | ${result.durationMs}ms`);
    return { jobId, status: 'pending_build_review', filesCount: fileList.length };
  } catch (err) {
    console.error(`[Developer Agent] ${jobId} build error:`, err.message);
    updateJobStatus(jobId, 'failed', `Build failed: ${err.message}`);
    throw err;
  }
}

/**
 * Handle build rework jobs — load rejected build + feedback, call Claude to revise.
 */
async function handleReworkBuild(jobId, feedback) {
  console.log(`[Developer Agent] Reworking build for job ${jobId}`);

  const job = getJob(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  const specRow = getSpec(jobId);
  if (!specRow) {
    throw new Error(`No spec found for job ${jobId}`);
  }

  const approvedSpec = typeof specRow.spec_json === 'string'
    ? JSON.parse(specRow.spec_json)
    : specRow.spec_json;

  const challengeRow = getChallenge(jobId);
  if (!challengeRow) {
    throw new Error(`No challenge found for job ${jobId}`);
  }

  const existingFiles = typeof challengeRow.file_manifest === 'string'
    ? JSON.parse(challengeRow.file_manifest)
    : challengeRow.file_manifest;

  // Convert file_manifest array back to files object for the prompt
  const filesObj = {};
  if (Array.isArray(existingFiles)) {
    for (const f of existingFiles) {
      filesObj[f.path] = f.content;
    }
  } else if (existingFiles && typeof existingFiles === 'object') {
    Object.assign(filesObj, existingFiles);
  }

  // Load rework-build prompt and inject flags
  const promptPath = resolve(PROMPTS_DIR, 'rework-build.md');
  let systemPrompt;
  try {
    systemPrompt = readFileSync(promptPath, 'utf-8');
  } catch {
    throw new Error('rework-build.md prompt not found');
  }

  const realFlag = approvedSpec.flag || 'Exploit3rs{default_flag}';
  const honeypotFlag = approvedSpec.honeypotFlag || 'Exploit3rs{fake_flag}';
  systemPrompt = systemPrompt.replace(/\{FLAG\}/g, realFlag);
  systemPrompt = systemPrompt.replace(/\{HONEYPOT_FLAG\}/g, honeypotFlag);

  const userPrompt = [
    `== APPROVED SPEC ==`,
    JSON.stringify(approvedSpec, null, 2),
    ``,
    `== EXISTING BUILD (REJECTED) ==`,
    JSON.stringify({ files: filesObj }, null, 2),
    ``,
    `== REVIEWER FEEDBACK ==`,
    feedback,
    ``,
    `== REVISION NUMBER ==`,
    `This is build revision ${job.build_revision || 2} of 3. Fix ALL issues raised in the feedback.`,
  ].join('\n');

  updateJobStatus(jobId, 'developing');

  try {
    const { result, tokenUsage, durationMs } = await generateJSON({
      systemPrompt,
      userPrompt,
      maxRetries: 2,
      maxTokens: 8192,
    });

    if (!result.files || typeof result.files !== 'object') {
      throw new Error('Rework output missing "files" object');
    }

    // Save revised files to disk
    saveFiles(jobId, result.files);

    // Update challenge in DB
    const fileList = Object.keys(result.files);
    const fileManifest = fileList.map((filePath) => ({
      path: filePath,
      language: detectLanguage(filePath),
      content: result.files[filePath],
    }));

    updateChallenge(jobId, fileManifest, tokenUsage, durationMs);
    createBuildVersion({ jobId, revision: job.build_revision || 2, fileManifest, feedback, tokenUsage });
    updateJobStatus(jobId, 'pending_build_review');

    console.log(`[Developer Agent] ${jobId} build rework complete (rev ${job.build_revision}) | ${fileList.length} files | ${tokenUsage} tokens`);
    return { jobId, status: 'pending_build_review', filesCount: fileList.length };
  } catch (err) {
    console.error(`[Developer Agent] ${jobId} build rework failed:`, err.message);
    updateJobStatus(jobId, 'failed', `Build rework failed: ${err.message}`);
    throw err;
  }
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
  if (filePath.toLowerCase().endsWith('dockerfile')) return 'dockerfile';
  if (filePath.toLowerCase().endsWith('makefile')) return 'makefile';
  return map[ext] || 'text';
}
