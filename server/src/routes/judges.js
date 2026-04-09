import { Router } from 'express';
import { getDb } from '../db/init.js';
import bcrypt from 'bcrypt';

const router = Router({ mergeParams: true });

/**
 * POST /api/events/:eventId/judges
 * Add a new judge to an event.
 */
router.post('/', async (req, res) => {
  const { eventId } = req.params;
  const { seat_number, name, pin } = req.body;

  // Validation
  if (!seat_number || !name || !pin) {
    return res.status(400).json({ error: 'seat_number, name, and pin are required' });
  }

  if (typeof seat_number !== 'number' || seat_number < 1) {
    return res.status(400).json({ error: 'seat_number must be a positive integer' });
  }

  if (typeof pin !== 'string' || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    return res.status(400).json({ error: 'pin must be exactly 4 digits' });
  }

  try {
    const db = getDb();

    // Verify event exists
    const event = db.prepare('SELECT id FROM events WHERE id = ?').get(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Hash the PIN
    const pinHash = await bcrypt.hash(pin, 10);

    // Insert judge
    const stmt = db.prepare(
      'INSERT INTO judges (event_id, seat_number, name, pin_hash) VALUES (?, ?, ?, ?)'
    );
    const result = stmt.run(parseInt(eventId), seat_number, name.trim(), pinHash);

    const judge = db.prepare(
      'SELECT id, event_id, seat_number, name FROM judges WHERE id = ?'
    ).get(result.lastInsertRowid);

    return res.status(201).json(judge);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: `Judge with seat number ${seat_number} already exists for this event` });
    }
    console.error('[Error] Creating judge:', err);
    return res.status(500).json({ error: 'Failed to create judge' });
  }
});

/**
 * GET /api/events/:eventId/judges
 * Get all judges for an event.
 */
router.get('/', (req, res) => {
  const { eventId } = req.params;

  try {
    const db = getDb();
    const judges = db
      .prepare('SELECT id, event_id, seat_number, name FROM judges WHERE event_id = ? ORDER BY seat_number')
      .all(eventId);
    return res.json(judges);
  } catch (err) {
    console.error('[Error] Fetching judges:', err);
    return res.status(500).json({ error: 'Failed to fetch judges' });
  }
});

/**
 * DELETE /api/events/:eventId/judges/:judgeId
 * Delete a judge from an event.
 */
router.delete('/:judgeId', (req, res) => {
  const { eventId, judgeId } = req.params;

  try {
    const db = getDb();
    const judge = db.prepare('SELECT id FROM judges WHERE id = ? AND event_id = ?').get(judgeId, eventId);

    if (!judge) {
      return res.status(404).json({ error: 'Judge not found for this event' });
    }

    db.prepare('DELETE FROM judges WHERE id = ?').run(judgeId);
    return res.status(204).send();
  } catch (err) {
    console.error('[Error] Deleting judge:', err);
    return res.status(500).json({ error: 'Failed to delete judge' });
  }
});

export default router;
