import { Router } from 'express';
import { eventsService } from '../services/eventsService.js';
import { contestantsService } from '../services/contestantsService.js';

const router = Router({ mergeParams: true });

function getIo(req) {
  return req.app.get('io');
}

/**
 * POST /api/events/:eventId/contestants
 * Add a new contestant to an event.
 */
router.post('/', async (req, res, next) => {
  const { eventId } = req.params;
  const { number, name } = req.body;

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
    // Verify event exists
    const event = eventsService.getById(parseInt(eventId, 10));
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const contestant = contestantsService.create(parseInt(eventId, 10), {
      number,
      name: name.trim(),
    });

    // 10.3.5: Broadcast contestant added
    const io = getIo(req);
    if (io) {
      const { broadcastContestantAdded } = await import('../socket.js');
      broadcastContestantAdded(io, contestant);
    }

    return res.status(201).json(contestant);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: `Contestant number ${number} already exists for this event` });
    }
    next(err);
  }
});

/**
 * GET /api/events/:eventId/contestants
 * Get all contestants for an event.
 */
router.get('/', (req, res, next) => {
  const { eventId } = req.params;

  try {
    const contestants = contestantsService.getAll(parseInt(eventId, 10));
    return res.json(contestants);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/contestants/:id
 * Update a contestant's name or status.
 */
router.patch('/:id', (req, res, next) => {
  const { id } = req.params;
  const { name, status } = req.body;

  try {
    const contestant = contestantsService.getById(parseInt(id, 10));
    if (!contestant) {
      return res.status(404).json({ error: 'Contestant not found' });
    }

    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      return res.status(400).json({ error: 'name cannot be empty' });
    }

    if (status !== undefined && !['active', 'withdrawn'].includes(status)) {
      return res.status(400).json({ error: 'status must be "active" or "withdrawn"' });
    }

    const updated = contestantsService.update(parseInt(id, 10), {
      name: name?.trim(),
      status,
    });
    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/contestants/:id
 * Soft delete a contestant (set status to withdrawn).
 */
router.delete('/:id', (req, res, next) => {
  const { id } = req.params;

  try {
    const contestant = contestantsService.getById(parseInt(id, 10));
    if (!contestant) {
      return res.status(404).json({ error: 'Contestant not found' });
    }

    contestantsService.softDelete(parseInt(id, 10));
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
