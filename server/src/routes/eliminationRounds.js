import { Router } from 'express';
import { getDb } from '../db/init.js';

const router = Router();

/**
 * POST /api/elimination-rounds
 * Create a new elimination round with qualifiers.
 */
router.post('/', (req, res, next) => {
  const { event_id, round_name, round_order, contestant_count, based_on_report_id, qualifiers } = req.body;

  if (!event_id || !round_name || round_order == null || contestant_count == null) {
    return res.status(400).json({ error: 'event_id, round_name, round_order, and contestant_count are required' });
  }

  if (!qualifiers || !Array.isArray(qualifiers) || qualifiers.length === 0) {
    return res.status(400).json({ error: 'qualifiers array is required and must not be empty' });
  }

  try {
    const db = getDb();

    // Verify event exists
    const event = db.prepare('SELECT id FROM events WHERE id = ?').get(event_id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Create elimination round
    const roundResult = db
      .prepare(
        'INSERT INTO elimination_rounds (event_id, round_name, round_order, contestant_count, based_on_report_id) VALUES (?, ?, ?, ?, ?)'
      )
      .run(event_id, round_name, round_order, contestant_count, based_on_report_id || null);

    const roundId = roundResult.lastInsertRowid;

    // Insert qualifiers
    const insertQualifier = db.prepare(
      'INSERT INTO round_qualifiers (round_id, contestant_id, qualified_rank) VALUES (?, ?, ?)'
    );

    const dbTx = db.transaction(() => {
      for (const q of qualifiers) {
        insertQualifier.run(roundId, q.contestant_id, q.rank);
      }
    });

    dbTx();

    // Fetch created round with qualifiers
    const round = db.prepare('SELECT * FROM elimination_rounds WHERE id = ?').get(roundId);
    const qualifiersResult = db
      .prepare(
        `SELECT rq.contestant_id, rq.qualified_rank, c.number, c.name
         FROM round_qualifiers rq
         JOIN contestants c ON c.id = rq.contestant_id
         WHERE rq.round_id = ?
         ORDER BY rq.qualified_rank`
      )
      .all(roundId);

    return res.status(201).json({ ...round, qualifiers: qualifiersResult });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: `Round order ${round_order} already exists for this event` });
    }
    next(err);
  }
});

/**
 * GET /api/elimination-rounds?event_id=X
 * List all elimination rounds for an event.
 */
router.get('/', (req, res, next) => {
  const { event_id } = req.query;

  if (!event_id) {
    return res.status(400).json({ error: 'event_id query parameter is required' });
  }

  try {
    const db = getDb();
    const rounds = db
      .prepare('SELECT * FROM elimination_rounds WHERE event_id = ? ORDER BY round_order')
      .all(event_id);

    return res.json(rounds);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/elimination-rounds/:roundId/qualifiers
 * Get qualified contestants for a specific round.
 */
router.get('/:roundId/qualifiers', (req, res, next) => {
  const { roundId } = req.params;

  try {
    const db = getDb();
    const round = db.prepare('SELECT * FROM elimination_rounds WHERE id = ?').get(roundId);

    if (!round) {
      return res.status(404).json({ error: 'Elimination round not found' });
    }

    const qualifiers = db
      .prepare(
        `SELECT rq.contestant_id, rq.qualified_rank, c.number, c.name, c.status
         FROM round_qualifiers rq
         JOIN contestants c ON c.id = rq.contestant_id
         WHERE rq.round_id = ?
         ORDER BY rq.qualified_rank`
      )
      .all(roundId);

    return res.json({ round, qualifiers });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/elimination-rounds/:roundId
 * Delete an elimination round and its qualifiers.
 */
router.delete('/:roundId', (req, res, next) => {
  const { roundId } = req.params;

  try {
    const db = getDb();
    const round = db.prepare('SELECT id FROM elimination_rounds WHERE id = ?').get(roundId);

    if (!round) {
      return res.status(404).json({ error: 'Elimination round not found' });
    }

    db.prepare('DELETE FROM round_qualifiers WHERE round_id = ?').run(roundId);
    db.prepare('DELETE FROM elimination_rounds WHERE id = ?').run(roundId);

    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
