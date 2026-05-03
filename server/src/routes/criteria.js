import { Router } from 'express';
import { categoriesService } from '../services/categoriesService.js';
import { criteriaService } from '../services/criteriaService.js';
import { verifyAdmin } from './adminAuth.js';
import { getDb } from '../db/init.js';

const router = Router({ mergeParams: true });

/**
 * POST /api/categories/:categoryId/criteria
 * Create a new criterion for a category.
 */
router.post('/', verifyAdmin, (req, res, next) => {
  const { categoryId } = req.params;
  const { name, weight, min_score, max_score, display_order } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Criterion name is required' });
  }

  if (weight === undefined || typeof weight !== 'number' || weight < 0 || weight > 1) {
    return res.status(400).json({ error: 'Weight must be a number between 0 and 1 (representing 0% to 100%)' });
  }

  try {
    const category = categoriesService.getById(parseInt(categoryId, 10));
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Determine default max_score based on event's scoring mode
    const db = getDb();
    const event = db.prepare('SELECT scoring_mode FROM events WHERE id = ?').get(category.event_id);
    const isDirect = event?.scoring_mode === 'direct';
    const resolvedMaxScore = max_score ?? (isDirect ? Math.round(weight * 100) : 10);

    const criterion = criteriaService.create(parseInt(categoryId, 10), {
      name: name.trim(),
      weight,
      min_score: min_score ?? 0,
      max_score: resolvedMaxScore,
      display_order: display_order ?? Math.floor(Date.now() / 1000),
    });

    const totalWeight = criteriaService.getTotalWeight(parseInt(categoryId, 10));
    if (totalWeight > 1) {
      criteriaService.delete(criterion.id);
      return res.status(400).json({ error: `Cannot add criterion: total percentage would exceed 100%. Current: ${(totalWeight * 100).toFixed(1)}%` });
    }

    return res.status(201).json(criterion);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/categories/:categoryId/criteria
 * Get all criteria for a category.
 */
router.get('/', (req, res, next) => {
  const { categoryId } = req.params;

  try {
    const criteria = criteriaService.getAll(parseInt(categoryId, 10));
    return res.json(criteria);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/categories/:categoryId/criteria/:criterionId
 * Delete a criterion.
 */
router.delete('/:criterionId', verifyAdmin, (req, res, next) => {
  const { categoryId, criterionId } = req.params;

  try {
    const criterion = criteriaService.getById(parseInt(criterionId, 10));
    if (!criterion) {
      return res.status(404).json({ error: 'Criterion not found' });
    }

    // Verify criterion belongs to this category
    if (criterion.category_id !== parseInt(categoryId, 10)) {
      return res.status(404).json({ error: 'Criterion not found for this category' });
    }

    criteriaService.delete(parseInt(criterionId, 10));
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;