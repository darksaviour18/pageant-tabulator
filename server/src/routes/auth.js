import { Router } from 'express';
import { authService } from '../services/authService.js';
import { eventsService } from '../services/eventsService.js';

const router = Router({ mergeParams: true });

/**
 * POST /api/auth/judge
 * Authenticate a judge with seat number + PIN.
 * Returns judge info and event details.
 */
router.post('/', async (req, res, next) => {
  const { event_id, seat_number, pin } = req.body;

  // Validation
  if (!event_id || !seat_number || !pin) {
    return res.status(400).json({ error: 'event_id, seat_number, and pin are required' });
  }

  if (typeof event_id !== 'number' || event_id < 1) {
    return res.status(400).json({ error: 'event_id must be a positive integer' });
  }

  if (typeof seat_number !== 'number' || seat_number < 1) {
    return res.status(400).json({ error: 'seat_number must be a positive integer' });
  }

  if (typeof pin !== 'string' || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    return res.status(400).json({ error: 'pin must be exactly 4 digits' });
  }

  try {
    // Verify event exists
    const event = eventsService.getById(event_id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.status !== 'active') {
      return res.status(403).json({ error: 'This event is archived and no longer accepting scores' });
    }

    const judge = await authService.authenticateJudge(event_id, seat_number, pin);

    if (!judge) {
      return res.status(401).json({ error: 'Invalid seat number or PIN' });
    }

    return res.json({
      judge,
      event: {
        id: event.id,
        name: event.name,
        status: event.status,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
