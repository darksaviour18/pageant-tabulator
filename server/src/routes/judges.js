import { Router } from 'express';
import { eventsService } from '../services/eventsService.js';
import { judgesService } from '../services/judgesService.js';

const router = Router({ mergeParams: true });

/**
 * POST /api/events/:eventId/judges
 * Add a new judge to an event.
 */
router.post('/', async (req, res, next) => {
  const { eventId } = req.params;
  const { seat_number, name, pin } = req.body;

  // Validation
  if (!seat_number || !name || !pin) {
    return res.status(400).json({ error: 'seat_number, name, and pin are required' });
  }

  if (typeof seat_number !== 'number' || seat_number < 1 || !Number.isInteger(seat_number)) {
    return res.status(400).json({ error: 'seat_number must be a positive integer' });
  }

  if (typeof pin !== 'string' || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    return res.status(400).json({ error: 'pin must be exactly 4 digits' });
  }

  try {
    // Verify event exists
    const event = eventsService.getById(parseInt(eventId, 10));
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const judge = await judgesService.create(parseInt(eventId, 10), {
      seat_number,
      name: name.trim(),
      pin,
    });
    return res.status(201).json(judge);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: `Judge with seat number ${seat_number} already exists for this event` });
    }
    next(err);
  }
});

/**
 * GET /api/events/:eventId/judges
 * Get all judges for an event.
 */
router.get('/', (req, res, next) => {
  const { eventId } = req.params;

  try {
    const judges = judgesService.getAll(parseInt(eventId, 10));
    return res.json(judges);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/events/:eventId/judges/:judgeId
 * Delete a judge from an event.
 */
router.delete('/:judgeId', (req, res, next) => {
  const { eventId, judgeId } = req.params;

  try {
    const judge = judgesService.getById(parseInt(judgeId, 10));
    if (!judge || judge.event_id !== parseInt(eventId, 10)) {
      return res.status(404).json({ error: 'Judge not found for this event' });
    }

    judgesService.delete(parseInt(judgeId, 10));
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
