import { Router } from 'express';
import { z } from 'zod';
import { createBatch, createJob } from '../../db/client.js';
import { addResearchJob } from '../../queue/index.js';

const router = Router();

const cveItemSchema = z.string().regex(/^CVE-\d{4}-\d{4,}$/, 'Invalid CVE ID format');

const ideaItemSchema = z.object({
  description: z.string().min(10, 'Description must be at least 10 characters'),
  category: z.enum(['web', 'forensics', 'cryptography', 'osint', 'network', 'pwn']),
  difficulty: z.enum(['easy', 'medium', 'hard', 'expert']),
});

const implementSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('cve'),
    items: z.array(cveItemSchema).min(1).max(20),
  }),
  z.object({
    mode: z.literal('idea'),
    items: z.array(ideaItemSchema).min(1).max(20),
  }),
]);

router.post('/', async (req, res) => {
  try {
    const parsed = implementSchema.parse(req.body);
    const batch = createBatch(parsed.mode, parsed.items.length);
    const jobs = [];

    for (const item of parsed.items) {
      let jobData;
      if (parsed.mode === 'cve') {
        jobData = { batchId: batch.id, cveId: item, category: 'web' };
      } else {
        jobData = {
          batchId: batch.id,
          ideaText: item.description,
          category: item.category,
          difficulty: item.difficulty,
        };
      }

      const job = createJob(jobData);
      jobs.push(job);

      try {
        await addResearchJob(job.id);
      } catch (err) {
        console.error(`[Implement] Failed to enqueue job ${job.id}:`, err.message);
      }
    }

    res.status(201).json({
      batch_id: batch.id,
      jobs: jobs.map((j) => ({ id: j.id, status: j.status })),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    console.error('[Implement] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
