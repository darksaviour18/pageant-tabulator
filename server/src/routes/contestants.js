import { Router } from 'express';
import { getDb } from '../db/init.js';

const router = Router({ mergeParams: true });

/**
 * POST /api/events/:eventId/contestants
 * Add a new contestant to an event.
 */
router.post('/', (req, res) => {
  const { eventId } = req.params;
  const { number, name } = req.body;

  // Validation
  if (number === undefined || number === null || !name) {
    return res.status(400).json({ error: 'number and name are required' });
  }

  if (typeof number !== 'number' || number < 1 || !Number.isInteger(number)) {
    return res.status(400).json({ error: 'number must be a positive integer' });
  }

  if (typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'name cannot be empty' });
  }

  try {
    const db = getDb();

    // Verify event exists
    const event = db.prepare('SELECT id FROM events WHERE id = ?').get(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Insert contestant
    const stmt = db.prepare(
      'INSERT INTO contestants (event_id, number, name) VALUES (?, ?, ?)'
    );
    const result = stmt.run(parseInt(eventId), number, name.trim());

    const contestant = db
      .prepare('SELECT * FROM contestants WHERE id = ?')
      .get(result.lastInsertRowid);

    return res.status(201).json(contestant);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: `Contestant number ${number} already exists for this event` });
    }
    console.error('[Error] Creating contestant:', err);
    return res.status(500).json({ error: 'Failed to create contestant' });
  }
});

/**
 * GET /api/events/:eventId/contestants
 * Get all contestants for an event.
 */
router.get('/', (req, res) => {
  const { eventId } = req.params;

  try {
    const db = getDb();
    const contestants = db
      .prepare('SELECT * FROM contestants WHERE event_id = ? ORDER BY number')
      .all(eventId);
    return res.json(contestants);
  } catch (err) {
    console.error('[Error] Fetching contestants:', err);
    return res.status(500).json({ error: 'Failed to fetch contestants' });
  }
});

/**
 * PATCH /api/contestants/:id
 * Update a contestant's name or status.
 */
router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const { name, status } = req.body;

  try {
    const db = getDb();
    const contestant = db.prepare('SELECT * FROM contestants WHERE id = ?').get(id);

    if (!contestant) {
      return res.status(404).json({ error: 'Contestant not found' });
    }

    const updates = [];
    const values = [];

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'name cannot be empty' });
      }
      updates.push('name = ?');
      values.push(name.trim());
    }

    if (status !== undefined) {
      if (!['active', 'withdrawn'].includes(status)) {
        return res.status(400).json({ error: 'status must be "active" or "withdrawn"' });
      }
      updates.push('status = ?');
      values.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(id);
    const stmt = db.prepare(`UPDATE contestants SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    const updated = db.prepare('SELECT * FROM contestants WHERE id = ?').get(id);
    return res.json(updated);
  } catch (err) {
    console.error('[Error] Updating contestant:', err);
    return res.status(500).json({ error: 'Failed to update contestant' });
  }
});

/**
 * DELETE /api/contestants/:id
 * Soft delete a contestant (set status to withdrawn).
 */
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  try {
    const db = getDb();
    const contestant = db.prepare('SELECT id FROM contestants WHERE id = ?').get(id);

    if (!contestant) {
      return res.status(404).json({ error: 'Contestant not found' });
    }

    db.prepare("UPDATE contestants SET status = 'withdrawn' WHERE id = ?").run(id);
    return res.status(204).send();
  } catch (err) {
    console.error('[Error] Deleting contestant:', err);
    return res.status(500).json({ error: 'Failed to delete contestant' });
  }
});

export default router;
