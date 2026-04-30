import { Router } from 'express';
import { criteriaService } from '../services/criteriaService.js';
import { verifyAdmin } from './adminAuth.js';

const router = Router();

/**
 * PATCH /api/criteria/:criterionId
 * Update a criterion.
 */
router.patch('/:criterionId', verifyAdmin, (req, res, next) => {
  const { criterionId } = req.params;
  const { name, weight, min_score, max_score, display_order } = req.body;

  try {
    const criterion = criteriaService.getById(parseInt(criterionId, 10));
    if (!criterion) {
      return res.status(404).json({ error: 'Criterion not found' });
    }

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

    const totalWeight = criteriaService.getTotalWeight(criterion.category_id);
    if (totalWeight > 1) {
      return res.status(400).json({ error: `Cannot update criterion: total percentage would exceed 100%. Current: ${(totalWeight * 100).toFixed(1)}%` });
    }

    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;