import { Router } from 'express';
import { getCategory, getCategorySummaries } from '../../categories/index.js';

const router = Router();

// GET /api/categories — list all categories with their models
router.get('/', (req, res) => {
  try {
    const categories = getCategorySummaries();
    res.json({ categories });
  } catch (err) {
    console.error('[Categories] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/categories/:id — single category with full model
router.get('/:id', (req, res) => {
  try {
    const category = getCategory(req.params.id);
    if (!category) {
      return res.status(404).json({ error: `Category '${req.params.id}' not found` });
    }
    res.json(category);
  } catch (err) {
    console.error('[Categories] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
