import { Router } from 'express';
import { z } from 'zod';
import { getJob, updateJobStatus, updateJob, createReview } from '../../db/client.js';
import { addDeveloperJob, addReworkSpecJob, addReworkBuildJob } from '../../queue/index.js';

const router = Router();

const batchReviewSchema = z.object({
  jobIds: z.array(z.string()).min(1).max(50),
  stage: z.enum(['spec', 'build']),
  action: z.enum(['approve', 'reject']),
  notes: z.string().optional(),
});

router.post('/', async (req, res) => {
  try {
    const parsed = batchReviewSchema.parse(req.body);
    const { jobIds, stage, action, notes } = parsed;
    const expectedStatus = stage === 'spec' ? 'pending_spec_review' : 'pending_build_review';

    const results = [];
    let processed = 0;
    let skipped = 0;

    for (const jobId of jobIds) {
      const job = getJob(jobId);

      if (!job) {
        results.push({ jobId, success: false, error: 'Job not found' });
        skipped++;
        continue;
      }

      if (job.status !== expectedStatus) {
        results.push({ jobId, success: false, error: `Job is ${job.status}, expected ${expectedStatus}` });
        skipped++;
        continue;
      }

      createReview({ jobId, stage, action, notes: notes || null });

      if (action === 'approve') {
        if (stage === 'spec') {
          updateJobStatus(jobId, 'spec_approved');
          try { await addDeveloperJob(jobId); } catch {}
          results.push({ jobId, success: true, status: 'spec_approved' });
        } else {
          updateJobStatus(jobId, 'ready');
          results.push({ jobId, success: true, status: 'ready' });
        }
      } else {
        // Reject — trigger rework if notes provided and under limit
        const revisionKey = stage === 'spec' ? 'spec_revision' : 'build_revision';
        const revision = job[revisionKey] || 1;

        if (notes && notes.trim() && revision < 3) {
          const newStatus = stage === 'spec' ? 'reworking_spec' : 'reworking_build';
          updateJobStatus(jobId, newStatus);
          updateJob(jobId, { [revisionKey]: revision + 1 });

          try {
            if (stage === 'spec') {
              await addReworkSpecJob(jobId, notes);
            } else {
              await addReworkBuildJob(jobId, notes);
            }
          } catch {}

          results.push({ jobId, success: true, status: newStatus });
        } else {
          updateJobStatus(jobId, 'rejected_final');
          results.push({ jobId, success: true, status: 'rejected_final' });
        }
      }

      processed++;
    }

    res.json({ processed, skipped, total: jobIds.length, results });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    console.error('[BatchReview] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
