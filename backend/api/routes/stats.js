import { Router } from 'express';
import { getStats } from '../../db/client.js';

const router = Router();

router.get('/', (req, res) => {
  try {
    const stats = getStats();
    res.json(stats);
  } catch (err) {
    console.error('[Stats] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
