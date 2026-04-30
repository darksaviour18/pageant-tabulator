import { Router } from 'express';
import { eventsService } from '../services/eventsService.js';
import { categoriesService } from '../services/categoriesService.js';
import { verifyAdmin } from './adminAuth.js';
import { broadcastCategoryLock } from '../socket.js';

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

    const order = display_order ?? Math.floor(Date.now() / 1000);
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
  const { name, display_order, is_locked, weight } = req.body;

  try {
    const category = categoriesService.getById(parseInt(categoryId, 10));
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const updated = categoriesService.update(parseInt(categoryId, 10), {
      name: name?.trim(),
      display_order,
      is_locked,
      weight,
    });

    // 10.3.5: Broadcast category lock/unlock
    if (is_locked !== undefined) {
      const io = getIo(req);
      if (io) {
        broadcastCategoryLock(io, updated.id, !!is_locked);
      }
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