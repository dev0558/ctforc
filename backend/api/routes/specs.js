import { Router } from 'express';
import { z } from 'zod';
import { getJob, getSpec, updateJobStatus, createReview, createSpec } from '../../db/client.js';
import { addBuildJob } from '../../queue/index.js';

const router = Router();

const reviewSchema = z.object({
  action: z.enum(['approve', 'reject', 'edit_approve']),
  notes: z.string().optional(),
  edited_data: z.record(z.unknown()).optional(),
});

router.get('/:jobId', (req, res) => {
  try {
    const job = getJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const spec = getSpec(req.params.jobId);
    if (!spec) {
      return res.status(404).json({ error: 'Spec not found for this job' });
    }

    res.json({ job, spec });
  } catch (err) {
    console.error('[Specs] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:jobId/review', async (req, res) => {
  try {
    const job = getJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'pending_spec_review') {
      return res.status(400).json({ error: `Job is in '${job.status}' state, expected 'pending_spec_review'` });
    }

    const parsed = reviewSchema.parse(req.body);

    createReview({
      jobId: job.id,
      stage: 'spec',
      action: parsed.action,
      notes: parsed.notes,
      editedData: parsed.edited_data,
    });

    if (parsed.action === 'approve' || parsed.action === 'edit_approve') {
      // If edit_approve, update the spec with edited data
      if (parsed.action === 'edit_approve' && parsed.edited_data) {
        const existingSpec = getSpec(job.id);
        if (existingSpec) {
          const updatedSpec = { ...existingSpec.spec_json, ...parsed.edited_data };
          // Delete and recreate (sql.js doesn't have easy upsert)
          const db = (await import('../../db/client.js')).getDb();
          db.run('DELETE FROM specs WHERE job_id = ?', [job.id]);
          createSpec({ jobId: job.id, specJson: updatedSpec, tokenUsage: existingSpec.token_usage, generationTimeMs: existingSpec.generation_time_ms });
        }
      }

      updateJobStatus(job.id, 'spec_approved');

      try {
        await addBuildJob(job.id);
      } catch (err) {
        console.error(`[Specs] Failed to enqueue build for ${job.id}:`, err.message);
      }

      res.json({ status: 'spec_approved', message: 'Spec approved, build queued' });
    } else {
      updateJobStatus(job.id, 'rejected');
      res.json({ status: 'rejected', message: 'Spec rejected' });
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    console.error('[Specs] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
