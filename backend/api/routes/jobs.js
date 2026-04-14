import { Router } from 'express';
import { getJobs, getJob, getSpec, getChallenge, getReviews, getAnalysis, getSpecVersions, getBuildVersions } from '../../db/client.js';

const router = Router();

router.get('/', (req, res) => {
  try {
    const { status, category, batchId, limit, offset } = req.query;
    const jobs = getJobs({
      status,
      category,
      batchId,
      limit: limit ? parseInt(limit, 10) : 100,
      offset: offset ? parseInt(offset, 10) : 0,
    });
    res.json({ jobs, total: jobs.length });
  } catch (err) {
    console.error('[Jobs] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const job = getJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const analysis = getAnalysis(job.id);
    const spec = getSpec(job.id);
    const challenge = getChallenge(job.id);
    const reviews = getReviews(job.id);

    res.json({ ...job, analysis, spec, challenge, reviews });
  } catch (err) {
    console.error('[Jobs] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/jobs/:id/history — Full timeline of all versions and reviews.
 */
router.get('/:id/history', (req, res) => {
  try {
    const job = getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const specVersions = getSpecVersions(job.id);
    const buildVersions = getBuildVersions(job.id);
    const reviews = getReviews(job.id);

    // Build chronological timeline
    const timeline = [];

    for (const sv of specVersions) {
      timeline.push({
        type: 'spec_version',
        revision: sv.revision,
        tokenUsage: sv.token_usage,
        feedback: sv.feedback,
        timestamp: sv.created_at,
        data: sv.spec_json,
      });
    }

    for (const bv of buildVersions) {
      timeline.push({
        type: 'build_version',
        revision: bv.revision,
        tokenUsage: bv.token_usage,
        feedback: bv.feedback,
        timestamp: bv.created_at,
        fileCount: Array.isArray(bv.file_manifest) ? bv.file_manifest.length : 0,
      });
    }

    for (const r of reviews) {
      timeline.push({
        type: 'review',
        stage: r.stage,
        action: r.action,
        notes: r.notes,
        timestamp: r.created_at,
      });
    }

    // Sort by timestamp
    timeline.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));

    res.json({
      job,
      timeline,
      specVersions: specVersions.length,
      buildVersions: buildVersions.length,
      totalReviews: reviews.length,
    });
  } catch (err) {
    console.error('[Jobs] History error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
