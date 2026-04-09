import { Router } from 'express';
import { getDb } from '../db/init.js';

const router = Router();

/**
 * POST /api/events
 * Create a new event.
 */
router.post('/', (req, res) => {
  const { name } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Event name is required' });
  }

  try {
    const db = getDb();
    const stmt = db.prepare(
      'INSERT INTO events (name, status) VALUES (?, ?)'
    );
    const result = stmt.run(name.trim(), 'active');

    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid);

    return res.status(201).json(event);
  } catch (err) {
    console.error('[Error] Creating event:', err);
    return res.status(500).json({ error: 'Failed to create event' });
  }
});

/**
 * GET /api/events
 * Get all events.
 */
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const events = db.prepare('SELECT * FROM events ORDER BY created_at DESC').all();
    return res.json(events);
  } catch (err) {
    console.error('[Error] Fetching events:', err);
    return res.status(500).json({ error: 'Failed to fetch events' });
  }
});

/**
 * GET /api/events/:id
 * Get a single event with its judges, contestants, and categories.
 */
router.get('/:id', (req, res) => {
  const { id } = req.params;

  try {
    const db = getDb();
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(id);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const judges = db
      .prepare('SELECT id, event_id, seat_number, name FROM judges WHERE event_id = ? ORDER BY seat_number')
      .all(id);

    const contestants = db
      .prepare('SELECT * FROM contestants WHERE event_id = ? ORDER BY number')
      .all(id);

    const categories = db
      .prepare(`
        SELECT c.*,
          (SELECT json_group_array(
            json_object(
              'id', cr.id,
              'name', cr.name,
              'weight', cr.weight,
              'min_score', cr.min_score,
              'max_score', cr.max_score,
              'display_order', cr.display_order
            )
          ) FROM criteria cr WHERE cr.category_id = c.id) as criteria
        FROM categories c
        WHERE c.event_id = ?
        ORDER BY c.display_order
      `)
      .all(id);

    return res.json({ ...event, judges, contestants, categories });
  } catch (err) {
    console.error('[Error] Fetching event:', err);
    return res.status(500).json({ error: 'Failed to fetch event' });
  }
});

/**
 * PATCH /api/events/:id
 * Update event name or status.
 */
router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const { name, status } = req.body;

  try {
    const db = getDb();
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(id);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const updates = [];
    const values = [];

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Event name cannot be empty' });
      }
      updates.push('name = ?');
      values.push(name.trim());
    }

    if (status !== undefined) {
      if (!['active', 'archived'].includes(status)) {
        return res.status(400).json({ error: 'Status must be "active" or "archived"' });
      }
      updates.push('status = ?');
      values.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(id);
    const stmt = db.prepare(`UPDATE events SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    const updated = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
    return res.json(updated);
  } catch (err) {
    console.error('[Error] Updating event:', err);
    return res.status(500).json({ error: 'Failed to update event' });
  }
});

export default router;
