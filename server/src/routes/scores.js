import { Router } from 'express';
import { getDb } from '../db/init.js';

const router = Router();

/**
 * POST /api/scores
 * Save or update a single score.
 * Uses ON CONFLICT for upsert.
 */
router.post('/', (req, res, next) => {
  const { judge_id, contestant_id, criteria_id, category_id, score } = req.body;

  if (judge_id == null || contestant_id == null || criteria_id == null || category_id == null) {
    return res.status(400).json({ error: 'judge_id, contestant_id, criteria_id, and category_id are required' });
  }

  if (score === null || score === undefined || typeof score !== 'number') {
    return res.status(400).json({ error: 'score must be a number' });
  }

  try {
    const db = getDb();

    const stmt = db.prepare(
      `INSERT INTO scores (event_id, judge_id, contestant_id, criteria_id, category_id, score, updated_at)
       VALUES (
         (SELECT event_id FROM judges WHERE id = ?),
         ?, ?, ?, ?, ?,
         datetime('now')
       )
       ON CONFLICT(judge_id, contestant_id, criteria_id)
       DO UPDATE SET score = excluded.score, updated_at = datetime('now')`
    );

    const result = stmt.run(judge_id, judge_id, contestant_id, criteria_id, category_id, score);

    const saved = db
      .prepare(
        'SELECT id, judge_id, contestant_id, criteria_id, category_id, score, updated_at FROM scores WHERE id = ?'
      )
      .get(result.lastInsertRowid);

    return res.status(201).json(saved);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/scores/batch
 * Batch save multiple scores. Returns count of saved and any errors.
 */
router.post('/batch', (req, res, next) => {
  const { scores } = req.body;

  if (!Array.isArray(scores) || scores.length === 0) {
    return res.status(400).json({ error: 'scores array is required and must not be empty' });
  }

  try {
    const db = getDb();
    const dbTx = db.transaction((entries) => {
      const stmt = db.prepare(
        `INSERT INTO scores (event_id, judge_id, contestant_id, criteria_id, category_id, score, updated_at)
         VALUES (
           (SELECT event_id FROM judges WHERE id = ?),
           ?, ?, ?, ?, ?,
           datetime('now')
         )
         ON CONFLICT(judge_id, contestant_id, criteria_id)
         DO UPDATE SET score = excluded.score, updated_at = datetime('now')`
      );

      let saved = 0;
      const errors = [];

      for (let i = 0; i < entries.length; i++) {
        const s = entries[i];
        if (!s.judge_id || !s.contestant_id || !s.criteria_id || !s.category_id || s.score == null) {
          errors.push({ index: i, error: 'Missing required fields' });
          continue;
        }
        try {
          const result = stmt.run(s.judge_id, s.judge_id, s.contestant_id, s.criteria_id, s.category_id, s.score);
          if (result.changes > 0) saved++;
        } catch (err) {
          errors.push({ index: i, error: err.message });
        }
      }

      return { saved, errors };
    });

    const result = dbTx(scores);
    return res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
