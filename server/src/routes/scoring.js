import { Router } from 'express';
import { getDb } from '../db/init.js';

const router = Router();

/**
 * GET /api/scoring/:judgeId/event/:eventId
 * Get full scoring context for a judge: categories with criteria, contestants.
 */
router.get('/:judgeId/event/:eventId', (req, res, next) => {
  const { judgeId, eventId } = req.params;

  try {
    const db = getDb();

    // Verify judge belongs to this event
    const judge = db
      .prepare('SELECT id FROM judges WHERE id = ? AND event_id = ?')
      .get(judgeId, eventId);

    if (!judge) {
      return res.status(404).json({ error: 'Judge not found for this event' });
    }

    // 12.3.1: Filter contestants by active elimination round if specified
    const { round_id } = req.query;
    let contestants;
    if (round_id) {
      const round = db.prepare('SELECT id FROM elimination_rounds WHERE id = ? AND event_id = ?').get(round_id, eventId);
      if (round) {
        contestants = db
          .prepare(
            `SELECT c.id, c.number, c.name FROM contestants c
             INNER JOIN round_qualifiers rq ON rq.contestant_id = c.id
             WHERE rq.round_id = ? AND c.event_id = ? AND c.status = ?
             ORDER BY c.number`
          )
          .all(round_id, eventId, 'active');
      } else {
        contestants = [];
      }
    } else {
      contestants = db
        .prepare(
          'SELECT id, number, name FROM contestants WHERE event_id = ? AND status = ? ORDER BY number'
        )
        .all(eventId, 'active');
    }

    // Get all categories with their criteria
    const categories = db
      .prepare('SELECT id, name, display_order, is_locked FROM categories WHERE event_id = ? ORDER BY display_order')
      .all(eventId);

    const categoriesWithCriteria = categories.map((cat) => ({
      ...cat,
      criteria: db
        .prepare(
          'SELECT id, name, weight, min_score, max_score, display_order FROM criteria WHERE category_id = ? ORDER BY display_order'
        )
        .all(cat.id),
    }));

    return res.json({
      judge: { id: parseInt(judgeId, 10) },
      event: { id: parseInt(eventId, 10) },
      contestants,
      categories: categoriesWithCriteria,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/scoring/:judgeId/event/:eventId/category/:categoryId
 * Get all scores for a specific judge + category.
 */
router.get('/:judgeId/event/:eventId/category/:categoryId', (req, res, next) => {
  const { judgeId, categoryId } = req.params;

  try {
    const db = getDb();

    const scores = db
      .prepare(
        'SELECT contestant_id, criteria_id, score, updated_at FROM scores WHERE judge_id = ? AND category_id = ?'
      )
      .all(judgeId, categoryId);

    // Check submission status
    const submission = db
      .prepare('SELECT submitted, submitted_at, unlocked_by_admin FROM category_submissions WHERE judge_id = ? AND category_id = ?')
      .get(judgeId, categoryId);

    return res.json({
      scores,
      submitted: !!submission?.submitted,
      submittedAt: submission?.submitted_at,
      unlockedByAdmin: !!submission?.unlocked_by_admin,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
