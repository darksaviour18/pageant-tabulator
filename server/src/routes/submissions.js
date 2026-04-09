import { Router } from 'express';
import { getDb } from '../db/init.js';
import { writeAuditLog } from '../services/auditService.js';

const router = Router();

function getIo(req) {
  return req.app.get('io');
}

/**
 * POST /api/submissions
 * Submit a category for a judge (lock further edits).
 */
router.post('/', (req, res, next) => {
  const { judge_id, category_id } = req.body;

  if (!judge_id || !category_id) {
    return res.status(400).json({ error: 'judge_id and category_id are required' });
  }

  try {
    const db = getDb();

    db.prepare(
      `INSERT INTO category_submissions (judge_id, category_id, submitted, submitted_at, unlocked_by_admin)
       VALUES (?, ?, 1, datetime('now'), 0)
       ON CONFLICT(judge_id, category_id)
       DO UPDATE SET submitted = 1, submitted_at = datetime('now'), unlocked_by_admin = 0`
    ).run(judge_id, category_id);

    const submission = db
      .prepare('SELECT * FROM category_submissions WHERE judge_id = ? AND category_id = ?')
      .get(judge_id, category_id);

    // 10.1.5: Audit log — category submitted
    const eventRow = db.prepare('SELECT event_id FROM judges WHERE id = ?').get(judge_id);
    if (eventRow) {
      writeAuditLog(eventRow.event_id, judge_id, 'category_submitted', { category_id });
    }

    // Broadcast submission event
    const io = getIo(req);
    if (io) {
      io.emit('category_submitted', { judgeId: judge_id, categoryId: category_id });
    }

    return res.status(201).json(submission);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/submissions/unlock
 * Admin unlocks a judge's category sheet for re-editing.
 */
router.post('/unlock', async (req, res, next) => {
  const { judge_id, category_id } = req.body;

  if (!judge_id || !category_id) {
    return res.status(400).json({ error: 'judge_id and category_id are required' });
  }

  try {
    const db = getDb();

    db.prepare(
      `UPDATE category_submissions SET unlocked_by_admin = 1 WHERE judge_id = ? AND category_id = ?`
    ).run(judge_id, category_id);

    const submission = db
      .prepare('SELECT * FROM category_submissions WHERE judge_id = ? AND category_id = ?')
      .get(judge_id, category_id);

    // 10.1.5: Audit log — category unlocked
    const eventRow = db.prepare('SELECT event_id FROM judges WHERE id = ?').get(judge_id);
    if (eventRow) {
      writeAuditLog(eventRow.event_id, null, 'category_unlocked', { judge_id, category_id });
    }

    // Notify the specific judge that their sheet was unlocked
    const io = getIo(req);
    if (io) {
      // Find the judge's socket and notify
      const { notifySheetUnlocked } = await import('../socket.js');
      notifySheetUnlocked(io, judge_id, category_id);
    }

    return res.json(submission || { judge_id, category_id, unlocked_by_admin: 1 });
  } catch (err) {
    next(err);
  }
});

export default router;
