import { Router } from 'express';
import { categoriesService } from '../services/categoriesService.js';
import { criteriaService } from '../services/criteriaService.js';

const router = Router({ mergeParams: true });

/**
 * POST /api/categories/:categoryId/criteria
 * Create a new criterion for a category.
 */
router.post('/', (req, res, next) => {
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

    const criterion = criteriaService.create(parseInt(categoryId, 10), {
      name: name.trim(),
      weight,
      min_score: min_score ?? 0,
      max_score: max_score ?? 10,
      display_order: display_order ?? Math.floor(Date.now() / 1000),
    });

    // 10.3.4: Validate total weight after creation
    const totalWeight = criteriaService.getTotalWeight(parseInt(categoryId, 10));
    const warning = totalWeight > 1 ? ` Warning: total weight is ${(totalWeight * 100).toFixed(1)}%, exceeds 100%` : '';

    return res.status(201).json({ ...criterion, weight_warning: warning || null });
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
 * PATCH /api/criteria/:criterionId
 * Update a criterion.
 */
router.patch('/:criterionId', (req, res, next) => {
  const { criterionId } = req.params;
  const { name, weight, min_score, max_score, display_order } = req.body;

  try {
    const criterion = criteriaService.getById(parseInt(criterionId, 10));
    if (!criterion) {
      return res.status(404).json({ error: 'Criterion not found' });
    }

    // 11.1.2: Validate weight range on update
    if (weight !== undefined && (typeof weight !== 'number' || weight < 0 || weight > 1)) {
      return res.status(400).json({ error: 'Weight must be a number between 0 and 1 (representing 0% to 100%)' });
    }

    const updated = criteriaService.update(parseInt(criterionId, 10), {
      name: name?.trim(),
      weight,
      min_score,
      max_score,
      display_order,
    });
    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/criteria/:criterionId
 * Delete a criterion.
 */
router.delete('/:criterionId', (req, res, next) => {
  const { criterionId } = req.params;

  try {
    const criterion = criteriaService.getById(parseInt(criterionId, 10));
    if (!criterion) {
      return res.status(404).json({ error: 'Criterion not found' });
    }

    criteriaService.delete(parseInt(criterionId, 10));
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
