import { Router } from 'express';
import { eventsService } from '../services/eventsService.js';
import { categoriesService } from '../services/categoriesService.js';
import { verifyAdmin } from './adminAuth.js';
import { broadcastCategoryLock, broadcastContestantsUpdated } from '../socket.js';
import { getDb } from '../db/init.js';
import { writeAuditLog } from '../services/auditService.js';

const router = Router({ mergeParams: true });

function getIo(req) {
  return req.app.get('io');
}

/**
 * POST /api/events/:eventId/categories
 * Create a new category for an event.
 */
router.post('/', verifyAdmin, (req, res, next) => {
  const { eventId } = req.params;
  const { name, display_order, weight } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  try {
    const event = eventsService.getById(parseInt(eventId, 10));
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    let order = display_order;
    if (order == null) {
      // Auto-assign the next sequential order for this event
      const db = getDb();
      const maxRow = db
        .prepare('SELECT MAX(display_order) as max_order FROM categories WHERE event_id = ?')
        .get(parseInt(eventId, 10));
      order = (maxRow?.max_order ?? 0) + 1;
    }
    const category = categoriesService.create(parseInt(eventId, 10), {
      name: name.trim(),
      display_order: order,
      weight: weight ?? 1,
    });
    return res.status(201).json(category);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/events/:eventId/categories
 * Get all categories for an event with their criteria nested.
 */
router.get('/', (req, res, next) => {
  const { eventId } = req.params;

  try {
    const categories = eventsService.getCategoriesWithCriteria(parseInt(eventId, 10));
    return res.json(categories);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/categories/:categoryId
 * Update a category.
 */
router.patch('/:categoryId', verifyAdmin, async (req, res, next) => {
  const { categoryId } = req.params;
  const { name, display_order, is_locked, weight, required_round_id } = req.body;

  try {
    const category = categoriesService.getById(parseInt(categoryId, 10));
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Validate required_round_id if being set (not if being cleared)
    if (required_round_id !== undefined && required_round_id !== null) {
      const db = getDb();
      const round = db
        .prepare('SELECT id, event_id FROM elimination_rounds WHERE id = ?')
        .get(Number(required_round_id));

      if (!round) {
        return res.status(404).json({ error: 'Elimination round not found' });
      }
      if (round.event_id !== category.event_id) {
        return res.status(400).json({
          error: 'Elimination round does not belong to the same event as this category',
        });
      }
    }

    const previousRoundId = category.required_round_id;

    const updated = categoriesService.update(parseInt(categoryId, 10), {
      name: name?.trim(),
      display_order,
      is_locked,
      weight,
      required_round_id,
    });

    const io = getIo(req);

    if (is_locked !== undefined && io) {
      broadcastCategoryLock(io, updated.id, !!is_locked);
    }

    const roundChanged =
      required_round_id !== undefined &&
      Number(required_round_id || 0) !== Number(previousRoundId || 0);
    if (roundChanged && io) {
      broadcastContestantsUpdated(io, updated.id, updated.required_round_id ?? null);
    }

    if (roundChanged) {
      writeAuditLog(category.event_id, null, 'category_round_linked', {
        category_id: updated.id,
        category_name: updated.name,
        previous_round_id: previousRoundId ?? null,
        new_round_id: updated.required_round_id ?? null,
      });
    }

    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/events/:eventId/categories/:categoryId
 * Delete a category (cascades to criteria).
 */
router.delete('/:categoryId', verifyAdmin, (req, res, next) => {
  const { eventId, categoryId } = req.params;

  try {
    const category = categoriesService.getById(parseInt(categoryId, 10));

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Verify category belongs to this event
    if (category.event_id !== parseInt(eventId, 10)) {
      return res.status(404).json({ error: 'Category not found for this event' });
    }

    categoriesService.delete(parseInt(categoryId, 10));
    return res.status(204).send();
  } catch (err) {
    console.error(`[DELETE /categories] Error:`, err);
    next(err);
  }
});

export default router;