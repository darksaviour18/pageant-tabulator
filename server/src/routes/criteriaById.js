import { Router } from 'express';
import { criteriaService } from '../services/criteriaService.js';
import { verifyAdmin } from './adminAuth.js';
import { getDb } from '../db/init.js';

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

    // Check total weight BEFORE updating — prevent exceeding 100%
    if (weight !== undefined && weight !== criterion.weight) {
      const db = getDb();
      const cat = db.prepare('SELECT event_id FROM categories WHERE id = ?').get(criterion.category_id);
      if (cat && cat.event_id) {
        const scoreExists = db.prepare('SELECT COUNT(*) as cnt FROM scores WHERE category_id = ?').get(criterion.category_id).cnt > 0;
        if (scoreExists && scoreExists > 0) {
          return res.status(400).json({ error: 'Cannot change criterion weight after scoring has started.' });
        }
      }
      const currentTotal = criteriaService.getTotalWeight(criterion.category_id);
      const newTotal = currentTotal - criterion.weight + weight;
      if (newTotal > 1) {
        return res.status(400).json({
          error: `Cannot update criterion: total percentage would exceed 100%. Removing ${(criterion.weight * 100).toFixed(1)}%, adding ${(weight * 100).toFixed(1)}% would result in ${(newTotal * 100).toFixed(1)}%.`
        });
      }
    }

    // Derive max_score from weight if event is in direct mode and no explicit max_score
    let resolvedMaxScore = max_score;
    if (max_score === undefined && weight !== undefined && weight !== criterion.weight) {
      const db = getDb();
      const cat = db.prepare('SELECT event_id FROM categories WHERE id = ?').get(criterion.category_id);
      if (cat) {
        const event = db.prepare('SELECT scoring_mode FROM events WHERE id = ?').get(cat.event_id);
        if (event?.scoring_mode === 'direct') {
          resolvedMaxScore = Math.round(weight * 100);
        }
      }
    }

    const updated = criteriaService.update(parseInt(criterionId, 10), {
      name: name?.trim(),
      weight,
      min_score,
      max_score: resolvedMaxScore,
      display_order,
    });

    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;