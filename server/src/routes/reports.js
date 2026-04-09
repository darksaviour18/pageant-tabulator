import { Router } from 'express';
import { reportsService } from '../services/reportsService.js';

const router = Router({ mergeParams: true });

/**
 * GET /api/reports/:eventId/category/:categoryId
 * Generate a full tabulation report for a specific category.
 *
 * Returns:
 * - Category info
 * - Criteria with weights
 * - Judges
 * - Contestants
 * - All raw scores
 * - Rankings with weighted totals
 */
router.get('/:eventId/category/:categoryId', (req, res, next) => {
  const { eventId, categoryId } = req.params;

  try {
    const report = reportsService.generateCategoryReport(
      parseInt(eventId, 10),
      parseInt(categoryId, 10)
    );

    if (!report) {
      return res.status(404).json({ error: 'Category not found for this event' });
    }

    return res.json(report);
  } catch (err) {
    next(err);
  }
});

export default router;
