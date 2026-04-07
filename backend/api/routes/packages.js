import { Router } from 'express';
import archiver from 'archiver';
import { getJob, getChallenge, getSpec } from '../../db/client.js';

const router = Router();

/**
 * GET /api/packages/:jobId — Download a completed challenge as a ZIP file.
 * Only jobs with status "ready" can be downloaded.
 */
router.get('/:jobId', (req, res) => {
  try {
    const job = getJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'ready') {
      return res.status(400).json({
        error: `Job is in "${job.status}" state. Only "ready" challenges can be downloaded.`,
      });
    }

    const challenge = getChallenge(req.params.jobId);
    if (!challenge || !challenge.file_manifest) {
      return res.status(404).json({ error: 'Challenge files not found' });
    }

    const spec = getSpec(req.params.jobId);
    const specJson = spec?.spec_json || {};
    const challengeName = specJson.challengeName || specJson.challenge_name || 'challenge';

    // Sanitize name for filename
    const safeName = challengeName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
    const zipName = `${safeName}-${req.params.jobId.substring(0, 8)}.zip`;

    // Set response headers for ZIP download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    // Create ZIP archive and pipe to response
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (err) => {
      console.error('[Packages] Archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to create ZIP' });
      }
    });

    archive.pipe(res);

    // Add each file from the manifest
    const files = Array.isArray(challenge.file_manifest)
      ? challenge.file_manifest
      : [];

    for (const file of files) {
      if (file.path && file.content) {
        archive.append(file.content, { name: file.path });
      }
    }

    // Add a challenge.json metadata file
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
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

export default router;
