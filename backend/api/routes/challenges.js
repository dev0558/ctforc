import { Router } from 'express';
import { z } from 'zod';
import { join } from 'path';
import { getJob, getSpec, getChallenge, updateJobStatus, updateJob, createReview } from '../../db/client.js';
import { addReworkBuildJob } from '../../queue/index.js';
import { createPackages } from '../../packager/index.js';
import config from '../../config.js';

const router = Router();

const reviewSchema = z.object({
  action: z.enum(['approve', 'reject', 'reject_final']),
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

router.post('/:jobId/review', async (req, res) => {
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

      // Trigger package creation in the background
      const specRow = getSpec(job.id);
      const specJson = specRow?.spec_json ? (typeof specRow.spec_json === 'string' ? JSON.parse(specRow.spec_json) : specRow.spec_json) : {};
      const challengeRow = getChallenge(job.id);
      const challengeDir = join(config.storagePath, 'challenges', job.id);
      const testResults = challengeRow?.test_results || null;

      createPackages(job.id, specJson, challengeDir, testResults, config.storagePath)
        .then((pkgResult) => {
          console.log(`[Challenges] Packages created for ${job.id}: specialist=${pkgResult.specialistSize}B, participant=${pkgResult.participantSize}B`);
        })
        .catch((err) => {
          console.warn(`[Challenges] Package creation failed for ${job.id} (non-fatal):`, err.message);
        });

      res.json({ status: 'ready', message: 'Challenge approved and ready' });

    } else if (parsed.action === 'reject_final') {
      updateJobStatus(job.id, 'rejected_final');
      res.json({ status: 'rejected_final', message: 'Build permanently rejected' });

    } else if (parsed.action === 'reject') {
      const currentRevision = job.build_revision || 1;

      if (currentRevision >= 3) {
        updateJobStatus(job.id, 'rejected_final');
        res.json({
          status: 'rejected_final',
          message: `Build rejected permanently (max ${currentRevision} revisions reached)`,
        });
      } else if (!parsed.notes || parsed.notes.trim().length === 0) {
        updateJobStatus(job.id, 'rejected');
        res.json({ status: 'rejected', message: 'Build rejected (no feedback provided for rework)' });
      } else {
        updateJobStatus(job.id, 'reworking_build');
        updateJob(job.id, { build_revision: currentRevision + 1 });

        try {
          await addReworkBuildJob(job.id, parsed.notes);
        } catch (err) {
          console.error(`[Challenges] Failed to enqueue build rework for ${job.id}:`, err.message);
          updateJobStatus(job.id, 'pending_build_review');
        }

        res.json({
          status: 'reworking_build',
          message: `Build sent for AI rework (revision ${currentRevision + 1}/3)`,
          revision: currentRevision + 1,
        });
      }
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
