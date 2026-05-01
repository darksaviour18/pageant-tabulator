import { Router } from 'express';
import { getDb } from '../db/init.js';
import { writeAuditLog } from '../services/auditService.js';
import { invalidateReportCache } from '../services/reportsService.js';

const router = Router();

function getIo(req) {
  return req.app.get('io');
}

/**
 * Validate that a judge is allowed to submit scores for this category.
 * Checks: category not locked, category not submitted (unless admin-unlocked).
 *
 * Returns { valid: true } or { valid: false, error: string, status: number }.
 */
function checkCategoryAccessible(db, judgeId, categoryId) {
  // Check if category is locked
  const category = db.prepare('SELECT is_locked FROM categories WHERE id = ?').get(categoryId);
  if (!category) {
    return { valid: false, error: 'Category not found', status: 404 };
  }
  if (category.is_locked) {
    return { valid: false, error: 'This category is locked by the admin', status: 403 };
  }

  // Check if judge has submitted (and not been unlocked)
  const submission = db
    .prepare('SELECT submitted, unlocked_by_admin FROM category_submissions WHERE judge_id = ? AND category_id = ?')
    .get(judgeId, categoryId);

  if (submission && submission.submitted && !submission.unlocked_by_admin) {
    return { valid: false, error: 'You have already submitted this category', status: 403 };
  }

  return { valid: true };
}

/**
 * Validate score against criterion's min/max range.
 * Returns { valid: true } or { valid: false, error: string, status: number }.
 */
function validateScoreRange(db, criteriaId, score) {
  // Allow null/empty scores (for clearing)
  if (score === null || score === undefined || score === '') {
    return { valid: true };
  }
  
  const criterion = db.prepare('SELECT name, min_score, max_score FROM criteria WHERE id = ?').get(criteriaId);
  if (!criterion) {
    return { valid: false, error: 'Criterion not found', status: 404 };
  }
  if (score < criterion.min_score || score > criterion.max_score) {
    return {
      valid: false,
      error: `Score ${score} is out of range for "${criterion.name}" (${criterion.min_score}–${criterion.max_score})`,
      status: 400,
    };
  }
  return { valid: true };
}

/**
 * GET /api/scores?judge_id=X&category_id=Y
 * Get all scores for a specific judge and category.
 */
router.get('/', (req, res, next) => {
  const { judge_id, category_id } = req.query;

  if (!judge_id || !category_id) {
    return res.status(400).json({ error: 'judge_id and category_id query params are required' });
  }

  try {
    const db = getDb();
    const scores = db
      .prepare(
        'SELECT contestant_id, criteria_id, score, updated_at FROM scores WHERE judge_id = ? AND category_id = ?'
      )
      .all(judge_id, category_id);
    return res.json(scores);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/scores
 * Save or update a single score.
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

    // 10.1.1: Check category lock/submission status
    const lockCheck = checkCategoryAccessible(db, judge_id, category_id);
    if (!lockCheck.valid) {
      return res.status(lockCheck.status).json({ error: lockCheck.error });
    }

    // 11.1.1: Verify judge and category belong to the same event
    const judgeEvent = db.prepare('SELECT event_id FROM judges WHERE id = ?').get(judge_id);
    const catEvent = db.prepare('SELECT event_id FROM categories WHERE id = ?').get(category_id);
    if (!judgeEvent || !catEvent || judgeEvent.event_id !== catEvent.event_id) {
      return res.status(400).json({ error: 'Judge and category must belong to the same event' });
    }

    // 10.1.2: Validate score range
    const rangeCheck = validateScoreRange(db, criteria_id, score);
    if (!rangeCheck.valid) {
      return res.status(rangeCheck.status).json({ error: rangeCheck.error });
    }

    // Check if score already exists (for audit log accuracy)
    const existing = db.prepare(
      'SELECT id, score FROM scores WHERE judge_id = ? AND contestant_id = ? AND criteria_id = ?'
    ).get(judge_id, contestant_id, criteria_id);

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
      .get(existing ? existing.id : result.lastInsertRowid);

    // Get event_id for audit log
    const eventRow = db.prepare('SELECT event_id FROM judges WHERE id = ?').get(judge_id);

    // 10.1.5: Audit log — accurate action detection
    if (eventRow) {
      const action = existing ? 'score_updated' : 'score_entered';
      writeAuditLog(eventRow.event_id, judge_id, action, {
        contestant_id: saved.contestant_id,
        criteria_id: saved.criteria_id,
        score: saved.score,
        previous_score: existing?.score ?? null,
      });
    }

    // Broadcast real-time score update to admins
    const io = getIo(req);
    if (io) {
      io.to('admins').emit('score_updated', {
        judge_id: saved.judge_id,
        contestant_id: saved.contestant_id,
        criteria_id: saved.criteria_id,
        category_id: saved.category_id,
        score: saved.score,
      });
    }

    // Invalidate report cache for this category
    if (eventRow && saved.category_id) {
      invalidateReportCache(eventRow.event_id, saved.category_id);
    }

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

    // 10.1.1: Validate ALL entries' category lock status (batch may span categories)
    const categoryChecks = new Set();
    for (const s of scores) {
      if (s.judge_id && s.category_id) {
        const key = `${s.judge_id}:${s.category_id}`;
        if (!categoryChecks.has(key)) {
          categoryChecks.add(key);
          const lockCheck = checkCategoryAccessible(db, s.judge_id, s.category_id);
          if (!lockCheck.valid) {
            return res.status(lockCheck.status).json({ error: lockCheck.error });
          }
        }
      }
    }

    // 11.1.1: Validate ALL entries belong to the same event
    const eventChecks = new Set();
    for (const s of scores) {
      if (s.judge_id && s.category_id) {
        const key = `${s.judge_id}:${s.category_id}`;
        if (!eventChecks.has(key)) {
          eventChecks.add(key);
          const judgeEvent = db.prepare('SELECT event_id FROM judges WHERE id = ?').get(s.judge_id);
          const catEvent = db.prepare('SELECT event_id FROM categories WHERE id = ?').get(s.category_id);
          if (!judgeEvent || !catEvent || judgeEvent.event_id !== catEvent.event_id) {
            return res.status(400).json({ error: `Judge and category must belong to the same event (entry ${s.judge_id}/${s.category_id})` });
          }
        }
      }
    }

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
      const affectedCategories = new Set();
      const eventIds = new Set();

      for (let i = 0; i < entries.length; i++) {
        const s = entries[i];
        if (!s.judge_id || !s.contestant_id || !s.criteria_id || !s.category_id) {
          errors.push({ index: i, error: 'Missing required fields' });
          continue;
        }
        // Allow null scores (for clearing/resetting scores)

        // 10.1.2: Validate score range per entry
        const rangeCheck = validateScoreRange(db, s.criteria_id, s.score);
        if (!rangeCheck.valid) {
          errors.push({ index: i, error: rangeCheck.error });
          continue;
        }

        try {
          const result = stmt.run(s.judge_id, s.judge_id, s.contestant_id, s.criteria_id, s.category_id, s.score);
          if (result.changes > 0) {
            saved++;
            affectedCategories.add(s.category_id);
            const judgeEvent = db.prepare('SELECT event_id FROM judges WHERE id = ?').get(s.judge_id);
            if (judgeEvent) eventIds.add(judgeEvent.event_id);
          }
        } catch (err) {
          errors.push({ index: i, error: err.message });
        }
      }

      return { saved, errors, affectedCategories: [...affectedCategories], eventIds: [...eventIds] };
    });

    const result = dbTx(scores);

    // Invalidate report cache for affected categories
    for (const eventId of result.eventIds) {
      invalidateReportCache(eventId);
    }

    return res.json({ saved: result.saved, errors: result.errors });
  } catch (err) {
    next(err);
  }
});

export default router;
