import { Worker } from 'bullmq';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getConnection, addArchitectJob } from '../index.js';
import { getJob, updateJobStatus, updateJob, createAnalysis } from '../../db/client.js';
import { fetchCVE } from '../../researcher/nvdClient.js';
import { categorizeReferences } from '../../researcher/refCollector.js';
import { enrichContext } from '../../researcher/contextEnricher.js';
import { runAgent } from '../../agents/agentRunner.js';
import config from '../../config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = resolve(__dirname, '..', '..', 'agents', 'prompts');

let worker = null;

export function startResearcherWorker() {
  worker = new Worker(
    'research-queue',
    async (bullJob) => {
      const { jobId } = bullJob.data;
      return await handleResearch(jobId);
    },
    {
      connection: getConnection(),
      concurrency: config.queue.researcherConcurrency,
    }
  );

  worker.on('completed', (bullJob, result) => {
    console.log(`[Researcher Agent] Job ${bullJob.id} completed`);
  });

  worker.on('failed', (bullJob, err) => {
    console.error(`[Researcher Agent] Job ${bullJob?.id} failed:`, err.message);
  });

  console.log('[Researcher Agent] Started (3-stage pipeline: research → architect → developer)');
  return worker;
}

/**
 * Stage 1: Researcher Agent
 *
 * For CVE mode:
 *   1. Fetch NVD data (no LLM)
 *   2. Enrich context (CWE, MITRE, tech stack)
 *   3. Call Claude agent to produce technical analysis
 *   4. Lock immutable technology from NVD data
 *   5. Save analysis, hand off to Architect
 *
 * For idea mode:
 *   Skip to Architect directly (no CVE analysis needed)
 */
async function handleResearch(jobId) {
  console.log(`[Researcher Agent] Processing job ${jobId}`);

  const job = getJob(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  const label = job.cve_id || `idea: "${(job.idea_text || '').substring(0, 40)}"`;
  console.log(`[Researcher Agent] ${jobId} | ${label}`);

  updateJobStatus(jobId, 'researching');

  try {
    if (job.cve_id) {
      // CVE mode: full research pipeline
      const analysis = await researchCVE(jobId, job.cve_id);

      // Lock immutable technology from NVD-detected tech stack
      const immutableTech = analysis.affectedTechnology || {};
      updateJob(jobId, {
        immutable_tech: JSON.stringify(immutableTech),
        category: analysis.ctfRelevance?.suggestedCategory || job.category || 'web',
      });

      // Save analysis to DB
      createAnalysis({
        jobId,
        analysisJson: analysis,
        tokenUsage: analysis._tokenUsage || 0,
        generationTimeMs: analysis._durationMs || 0,
      });
      // Clean internal fields
      delete analysis._tokenUsage;
      delete analysis._durationMs;

      console.log(`[Researcher Agent] ${jobId} analysis saved, handing off to Architect`);
    } else {
      // Idea mode: no CVE analysis — save a minimal analysis stub
      createAnalysis({
        jobId,
        analysisJson: {
          type: 'idea',
          ideaText: job.idea_text,
          category: job.category,
          difficulty: job.difficulty,
        },
        tokenUsage: 0,
        generationTimeMs: 0,
      });
      console.log(`[Researcher Agent] ${jobId} idea mode, skipping CVE analysis`);
    }

    // Hand off to Architect agent
    updateJobStatus(jobId, 'architecting');
    await addArchitectJob(jobId);

    return { jobId, status: 'architecting' };
  } catch (err) {
    console.error(`[Researcher Agent] ${jobId} error:`, err.message);

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
 * CVE Research: fetch NVD data, enrich, then call Claude agent for deep analysis.
 */
async function researchCVE(jobId, cveId) {
  console.log(`[Researcher Agent] Fetching NVD data for ${cveId}`);

  // Phase 1: Data collection (no LLM)
  const nvdData = await fetchCVE(cveId);
  console.log(`[Researcher Agent] NVD data: CVSS ${nvdData.cvss.score}, ${nvdData.cwes.length} CWEs, ${nvdData.references.length} refs`);

  const categorizedRefs = categorizeReferences(nvdData.references);
  console.log(`[Researcher Agent] Refs: ${categorizedRefs.pocs.length} PoCs, ${categorizedRefs.advisories.length} advisories`);

  const enrichedContext = enrichContext(nvdData, categorizedRefs);
  console.log(`[Researcher Agent] Enriched: category=${enrichedContext.detectedCategory}, tech=[${enrichedContext.techStack.join(',')}]`);

  // Phase 2: Claude agent produces technical analysis
  const systemPrompt = readFileSync(resolve(PROMPTS_DIR, 'researcher-analysis.md'), 'utf-8');

  const userPrompt = buildAnalysisPrompt(enrichedContext);

  const { result, tokenUsage, durationMs } = await runAgent({
    agentName: 'Researcher',
    systemPrompt,
    userPrompt,
    maxTokens: 8192,
    jsonOutput: true,
  });

  // Inject enriched context data that the agent might have missed
  result._tokenUsage = tokenUsage;
  result._durationMs = durationMs;

  // Ensure technology data from NVD is preserved (immutable)
  if (!result.affectedTechnology) {
    result.affectedTechnology = {};
  }
  result.affectedTechnology.techStack = enrichedContext.techStack;
  result.affectedTechnology.detectedFromNVD = true;

  return result;
}

function buildAnalysisPrompt(ctx) {
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

  return `Analyze this CVE and produce a detailed technical analysis:

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

== DETECTED TECH STACK (from NVD/CPE - IMMUTABLE) ==
${ctx.techStack.join(', ')}

== REFERENCES ==
${refSummary.join('\n') || 'No categorized references'}
Public exploit exists: ${ctx.exploitExists ? 'YES' : 'NO'}

== CONTEXT ==
Detected Category: ${ctx.detectedCategory}
Suggested Difficulty: ${ctx.suggestedDifficulty}

Produce a thorough technical analysis as JSON.`;
}

export function getResearcherWorker() {
  return worker;
}
