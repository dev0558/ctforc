import { Router } from 'express';
import { z } from 'zod';
import { getJob, getSpec, getChallenge, updateJobStatus, createReview } from '../../db/client.js';

const router = Router();

const reviewSchema = z.object({
  action: z.enum(['approve', 'reject']),
  notes: z.string().optional(),
});

router.get('/:jobId', (req, res) => {
  try {
    const job = getJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const spec = getSpec(req.params.jobId);
    const challenge = getChallenge(req.params.jobId);
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found for this job' });
    }

    res.json({ job, spec, challenge });
  } catch (err) {
    console.error('[Challenges] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:jobId/review', (req, res) => {
  try {
    const job = getJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'pending_build_review') {
      return res.status(400).json({ error: `Job is in '${job.status}' state, expected 'pending_build_review'` });
    }

    const parsed = reviewSchema.parse(req.body);

    createReview({
      jobId: job.id,
      stage: 'build',
      action: parsed.action,
      notes: parsed.notes,
    });

    if (parsed.action === 'approve') {
      updateJobStatus(job.id, 'ready');
      res.json({ status: 'ready', message: 'Challenge approved and ready' });
    } else {
      updateJobStatus(job.id, 'rejected');
      res.json({ status: 'rejected', message: 'Challenge rejected' });
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    console.error('[Challenges] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
