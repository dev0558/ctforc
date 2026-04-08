import { Router } from 'express';
import { existsSync, readdirSync, statSync, createReadStream } from 'fs';
import { join } from 'path';
import archiver from 'archiver';
import { getJob, getChallenge, getSpec } from '../../db/client.js';
import config from '../../config.js';

const router = Router();

/**
 * GET /api/packages/:jobId — Legacy: Download a completed challenge as a ZIP file.
 */
router.get('/:jobId', (req, res, next) => {
  // Skip if it matches /specialist or /participant or /info
  if (['specialist', 'participant', 'info'].some((s) => req.params.jobId.endsWith(s))) {
    return next();
  }

  try {
    const job = getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.status !== 'ready') return res.status(400).json({ error: `Job is "${job.status}", only "ready" can be downloaded` });

    const challenge = getChallenge(req.params.jobId);
    if (!challenge || !challenge.file_manifest) return res.status(404).json({ error: 'Challenge files not found' });

    const spec = getSpec(req.params.jobId);
    const specJson = spec?.spec_json || {};
    const challengeName = specJson.challengeName || 'challenge';
    const safeName = challengeName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 50);
    const zipName = `${safeName}-${req.params.jobId.substring(0, 8)}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
      console.error('[Packages] Archive error:', err);
      if (!res.headersSent) res.status(500).json({ error: 'Failed to create ZIP' });
    });
    archive.pipe(res);

    const files = Array.isArray(challenge.file_manifest) ? challenge.file_manifest : [];
    for (const file of files) {
      if (file.path && file.content) archive.append(file.content, { name: file.path });
    }

    const metadata = {
      challengeName: specJson.challengeName || safeName,
      category: specJson.category || job.category,
      difficulty: specJson.difficulty || job.difficulty,
      points: specJson.points,
      flag: specJson.flag,
      jobId: job.id,
      generatedAt: challenge.created_at,
      tokenUsage: challenge.token_usage,
      generationTimeMs: challenge.generation_time_ms,
    };
    archive.append(JSON.stringify(metadata, null, 2), { name: 'challenge.json' });
    archive.finalize();
  } catch (err) {
    console.error('[Packages] Error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/packages/:jobId/specialist — Download specialist package.
 */
router.get('/:jobId/specialist', (req, res) => {
  servePackage(req.params.jobId, 'specialist', res);
});

/**
 * GET /api/packages/:jobId/participant — Download participant package.
 */
router.get('/:jobId/participant', (req, res) => {
  servePackage(req.params.jobId, 'participant', res);
});

/**
 * GET /api/packages/:jobId/info — Get package metadata.
 */
router.get('/:jobId/info', (req, res) => {
  try {
    const packageDir = join(config.storagePath, 'packages', req.params.jobId);

    if (!existsSync(packageDir)) {
      return res.json({ exists: false });
    }

    const allFiles = readdirSync(packageDir);
    const specialist = allFiles.find((f) => f.includes('specialist') && f.endsWith('.zip'));
    const participant = allFiles.find((f) => f.includes('participant') && f.endsWith('.zip'));

    res.json({
      exists: true,
      specialist: specialist ? { filename: specialist, size: statSync(join(packageDir, specialist)).size } : null,
      participant: participant ? { filename: participant, size: statSync(join(packageDir, participant)).size } : null,
    });
  } catch (err) {
    console.error('[Packages] Info error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function servePackage(jobId, type, res) {
  try {
    const packageDir = join(config.storagePath, 'packages', jobId);
    if (!existsSync(packageDir)) return res.status(404).json({ error: 'Package not found' });

    const files = readdirSync(packageDir).filter((f) => f.includes(type) && f.endsWith('.zip'));
    if (files.length === 0) return res.status(404).json({ error: `${type} package not found` });

    const zipPath = join(packageDir, files[0]);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${files[0]}"`);
    res.setHeader('Content-Length', statSync(zipPath).size);
    createReadStream(zipPath).pipe(res);
  } catch (err) {
    console.error('[Packages] Download error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export default router;
