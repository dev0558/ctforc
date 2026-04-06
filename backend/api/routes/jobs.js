import { Router } from 'express';
import { getJobs, getJob, getSpec, getChallenge, getReviews } from '../../db/client.js';

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

    const spec = getSpec(job.id);
    const challenge = getChallenge(job.id);
    const reviews = getReviews(job.id);

    res.json({ ...job, spec, challenge, reviews });
  } catch (err) {
    console.error('[Jobs] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
