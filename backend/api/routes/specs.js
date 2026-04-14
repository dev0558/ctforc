import { Router } from 'express';
import { z } from 'zod';
import { getJob, getSpec, updateJobStatus, updateJob, updateSpec, createReview, createSpec } from '../../db/client.js';
import { addDeveloperJob, addReworkSpecJob } from '../../queue/index.js';

const router = Router();

const reviewSchema = z.object({
  action: z.enum(['approve', 'reject', 'edit_approve', 'reject_final']),
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

    // Save review record
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
          updateSpec(job.id, updatedSpec, existingSpec.token_usage, existingSpec.generation_time_ms);
        }
      }

      updateJobStatus(job.id, 'spec_approved');

      try {
        await addDeveloperJob(job.id);
      } catch (err) {
        console.error(`[Specs] Failed to enqueue build for ${job.id}:`, err.message);
      }

      res.json({ status: 'spec_approved', message: 'Spec approved, build queued' });

    } else if (parsed.action === 'reject_final') {
      // Final rejection — no more rework attempts
      updateJobStatus(job.id, 'rejected_final');
      res.json({ status: 'rejected_final', message: 'Spec permanently rejected' });

    } else if (parsed.action === 'reject') {
      // Check revision count for rework cycle
      const currentRevision = job.spec_revision || 1;

      if (currentRevision >= 3) {
        // Max rework iterations reached — auto-reject_final
        updateJobStatus(job.id, 'rejected_final');
        res.json({
          status: 'rejected_final',
          message: `Spec rejected permanently (max ${currentRevision} revisions reached)`,
        });
      } else if (!parsed.notes || parsed.notes.trim().length === 0) {
        // Reject without feedback — just reject (no rework possible without feedback)
        updateJobStatus(job.id, 'rejected');
        res.json({ status: 'rejected', message: 'Spec rejected (no feedback provided for rework)' });
      } else {
        // Trigger rework cycle
        updateJobStatus(job.id, 'reworking_spec');
        updateJob(job.id, { spec_revision: currentRevision + 1 });

        try {
          await addReworkSpecJob(job.id, parsed.notes);
        } catch (err) {
          console.error(`[Specs] Failed to enqueue spec rework for ${job.id}:`, err.message);
          // If queue fails, revert to pending so reviewer can try again
          updateJobStatus(job.id, 'pending_spec_review');
        }

        res.json({
          status: 'reworking_spec',
          message: `Spec sent for AI rework (revision ${currentRevision + 1}/3)`,
          revision: currentRevision + 1,
        });
      }
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
