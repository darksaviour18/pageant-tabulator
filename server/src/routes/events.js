import { Router } from 'express';
import { eventsService } from '../services/eventsService.js';
import { verifyAdmin } from './adminAuth.js';
import { getDb } from '../db/init.js';
import { invalidateReportCache } from '../services/reportsService.js';

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
  const { name, status, tabulators, scoring_mode } = req.body;

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

    if (scoring_mode !== undefined && !['direct', 'weighted'].includes(scoring_mode)) {
      return res.status(400).json({ error: 'scoring_mode must be "direct" or "weighted"' });
    }

    // Lock scoring_mode change if scores already exist for this event
    if (scoring_mode !== undefined && scoring_mode !== existing.scoring_mode) {
      const db = getDb();
      const scoreCount = db.prepare('SELECT COUNT(*) as cnt FROM scores WHERE event_id = ?').get(parseInt(id, 10)).cnt;
      if (scoreCount > 0) {
        return res.status(400).json({ error: 'Scoring mode cannot be changed after judging has started.' });
      }

      // Auto-migrate all criteria max_score in this event to match the new mode
      if (scoring_mode === 'direct') {
        db.prepare(
          `UPDATE criteria SET max_score = ROUND(weight * 100), min_score = 0
           WHERE category_id IN (SELECT id FROM categories WHERE event_id = ?)`
        ).run(parseInt(id, 10));
      } else {
        db.prepare(
          `UPDATE criteria SET max_score = 10, min_score = 0
           WHERE category_id IN (SELECT id FROM categories WHERE event_id = ?)`
        ).run(parseInt(id, 10));
      }

      invalidateReportCache(parseInt(id, 10));
    }

    const updated = eventsService.update(parseInt(id, 10), {
      name: name?.trim(),
      status,
      tabulators: tabulators ? JSON.stringify(tabulators) : undefined,
      scoring_mode,
    });
    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/events/:id
 * Delete an event and all related data.
 */
router.delete('/:id', verifyAdmin, (req, res, next) => {
  const { id } = req.params;

  try {
    eventsService.delete(parseInt(id, 10));
    return res.status(204).send();
  } catch (err) {
    if (err.message === 'Event not found') {
      return res.status(404).json({ error: 'Event not found' });
    }
    next(err);
  }
});

export default router;
