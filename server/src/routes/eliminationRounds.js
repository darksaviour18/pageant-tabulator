import { Router } from 'express';
import { getDb } from '../db/init.js';
import { verifyAdmin } from './adminAuth.js';
import { writeAuditLog } from '../services/auditService.js';
import { invalidateReportCache } from '../services/reportsService.js';
import { broadcastContestantsUpdated } from '../socket.js';

const router = Router();

/**
 * POST /api/elimination-rounds
 * Create a new elimination round with qualifiers.
 * round_order auto-assigns as MAX(round_order)+1 if not provided.
 */
router.post('/', verifyAdmin, (req, res, next) => {
  const { event_id, round_name, round_order, contestant_count, based_on_report_id, qualifiers } = req.body;

  if (!event_id || !round_name || contestant_count == null) {
    return res.status(400).json({ error: 'event_id, round_name, and contestant_count are required' });
  }

  if (!qualifiers || !Array.isArray(qualifiers) || qualifiers.length === 0) {
    return res.status(400).json({ error: 'qualifiers array is required and must not be empty' });
  }

  try {
    const db = getDb();

    const event = db.prepare('SELECT id FROM events WHERE id = ?').get(event_id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const maxOrderRow = db
      .prepare('SELECT MAX(round_order) as max_order FROM elimination_rounds WHERE event_id = ?')
      .get(event_id);
    const nextOrder = (maxOrderRow?.max_order ?? 0) + 1;
    const resolvedRoundOrder = round_order != null ? Number(round_order) : nextOrder;

    const dbTx = db.transaction(() => {
      const roundResult = db
        .prepare(
          'INSERT INTO elimination_rounds (event_id, round_name, round_order, contestant_count, based_on_report_id) VALUES (?, ?, ?, ?, ?)'
        )
        .run(event_id, round_name, resolvedRoundOrder, contestant_count, based_on_report_id || null);

      const roundId = roundResult.lastInsertRowid;

      const insertQualifier = db.prepare(
        'INSERT INTO round_qualifiers (round_id, contestant_id, qualified_rank) VALUES (?, ?, ?)'
      );

      for (const q of qualifiers) {
        insertQualifier.run(roundId, q.contestant_id, q.rank);
      }

      return roundId;
    });

    const roundId = dbTx();

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

    writeAuditLog(event_id, null, 'elimination_round_created', {
      round_id: roundId,
      round_name,
      round_order: resolvedRoundOrder,
      contestant_count,
    });

    return res.status(201).json({ ...round, qualifiers: qualifiersResult });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/elimination-rounds?event_id=X
 * List all elimination rounds with linked categories.
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

    const enriched = rounds.map(round => {
      const linkedCategories = db
        .prepare('SELECT id, name FROM categories WHERE required_round_id = ?')
        .all(round.id);
      return { ...round, linked_categories: linkedCategories };
    });

    return res.json(enriched);
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
 * PATCH /api/elimination-rounds/:roundId/qualifiers
 * Replace the qualifier list for an existing round atomically.
 * Used for tie-breaking, withdrawal substitution, or correction.
 */
router.patch('/:roundId/qualifiers', verifyAdmin, (req, res, next) => {
  const { roundId } = req.params;
  const { qualifiers, contestant_count } = req.body;

  if (!qualifiers || !Array.isArray(qualifiers) || qualifiers.length === 0) {
    return res.status(400).json({ error: 'qualifiers array is required and must not be empty' });
  }

  for (const q of qualifiers) {
    if (!q.contestant_id || q.rank == null) {
      return res.status(400).json({ error: 'Each qualifier must have contestant_id and rank' });
    }
  }

  try {
    const db = getDb();
    const round = db.prepare('SELECT * FROM elimination_rounds WHERE id = ?').get(roundId);
    if (!round) {
      return res.status(404).json({ error: 'Elimination round not found' });
    }

    const dbTx = db.transaction(() => {
      db.prepare('DELETE FROM round_qualifiers WHERE round_id = ?').run(roundId);

      const insertQualifier = db.prepare(
        'INSERT INTO round_qualifiers (round_id, contestant_id, qualified_rank) VALUES (?, ?, ?)'
      );
      for (const q of qualifiers) {
        insertQualifier.run(roundId, q.contestant_id, q.rank);
      }

      const newCount = contestant_count ?? qualifiers.length;
      db.prepare('UPDATE elimination_rounds SET contestant_count = ? WHERE id = ?').run(newCount, roundId);
    });

    dbTx();

    invalidateReportCache(round.event_id);

    const io = req.app.get('io');
    if (io) {
      const linkedCategories = db
        .prepare('SELECT id FROM categories WHERE required_round_id = ?')
        .all(roundId);
      for (const cat of linkedCategories) {
        broadcastContestantsUpdated(io, cat.id, roundId);
      }
    }

    writeAuditLog(round.event_id, null, 'elimination_round_qualifiers_updated', {
      round_id: Number(roundId),
      round_name: round.round_name,
      new_count: qualifiers.length,
    });

    const updatedQualifiers = db
      .prepare(
        `SELECT rq.contestant_id, rq.qualified_rank, c.number, c.name
         FROM round_qualifiers rq
         JOIN contestants c ON c.id = rq.contestant_id
         WHERE rq.round_id = ?
         ORDER BY rq.qualified_rank`
      )
      .all(roundId);

    return res.json(updatedQualifiers);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/elimination-rounds/:roundId?event_id=X
 * Delete an elimination round. Categories linked to it revert to all-active pool.
 */
router.delete('/:roundId', verifyAdmin, (req, res, next) => {
  const { roundId } = req.params;
  const { event_id } = req.query;

  if (!event_id) {
    return res.status(400).json({ error: 'event_id query parameter is required' });
  }

  try {
    const db = getDb();
    const round = db.prepare('SELECT * FROM elimination_rounds WHERE id = ?').get(roundId);

    if (!round) {
      return res.status(404).json({ error: 'Elimination round not found' });
    }
    if (round.event_id !== parseInt(event_id, 10)) {
      return res.status(404).json({ error: 'Elimination round not found for this event' });
    }

    const linkedCategories = db
      .prepare('SELECT id FROM categories WHERE required_round_id = ?')
      .all(roundId);

    db.prepare('DELETE FROM round_qualifiers WHERE round_id = ?').run(roundId);
    db.prepare('DELETE FROM elimination_rounds WHERE id = ?').run(roundId);

    invalidateReportCache(parseInt(event_id, 10));

    const io = req.app.get('io');
    if (io) {
      for (const cat of linkedCategories) {
        broadcastContestantsUpdated(io, cat.id, null);
      }
    }

    writeAuditLog(parseInt(event_id, 10), null, 'elimination_round_deleted', {
      round_id: Number(roundId),
      round_name: round.round_name,
      affected_categories: linkedCategories.map(c => c.id),
    });

    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
