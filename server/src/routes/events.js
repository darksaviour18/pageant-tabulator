import { Router } from 'express';
import { eventsService } from '../services/eventsService.js';
import { verifyAdmin } from './adminAuth.js';

const router = Router();

/**
 * POST /api/events
 * Create a new event.
 */
router.post('/', verifyAdmin, (req, res, next) => {
  const { name } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Event name is required' });
  }

  try {
    const event = eventsService.create(name.trim());
    return res.status(201).json(event);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/events
 * Get all events.
 */
router.get('/', (req, res, next) => {
  try {
    const events = eventsService.getAll();
    return res.json(events);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/events/:id
 * Get a single event with its judges, contestants, and categories.
 */
router.get('/:id', (req, res, next) => {
  const { id } = req.params;

  try {
    const event = eventsService.getByIdWithRelations(parseInt(id, 10));
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    return res.json(event);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/events/:id
 * Update event name or status.
 */
router.patch('/:id', verifyAdmin, (req, res, next) => {
  const { id } = req.params;
  const { name, status, tabulators } = req.body;

  try {
    const existing = eventsService.getById(parseInt(id, 10));
    if (!existing) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      return res.status(400).json({ error: 'Event name cannot be empty' });
    }

    if (status !== undefined && !['active', 'archived'].includes(status)) {
      return res.status(400).json({ error: 'Status must be "active" or "archived"' });
    }

    if (tabulators !== undefined && !Array.isArray(tabulators)) {
      return res.status(400).json({ error: 'tabulators must be an array of {name: string}' });
    }

    const updated = eventsService.update(parseInt(id, 10), {
      name: name?.trim(),
      status,
      tabulators: tabulators ? JSON.stringify(tabulators) : undefined,
    });
    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
