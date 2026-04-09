import { getDb } from '../db/init.js';

/**
 * Write an entry to the audit_log table.
 *
 * @param {number} eventId
 * @param {number|null} judgeId
 * @param {string} action - e.g., 'score_entered', 'category_submitted'
 * @param {object|null} details - JSON-serializable metadata
 */
export function writeAuditLog(eventId, judgeId, action, details = null) {
  const db = getDb();
  db.prepare(
    'INSERT INTO audit_log (event_id, judge_id, action, details) VALUES (?, ?, ?, ?)'
  ).run(eventId, judgeId, action, details ? JSON.stringify(details) : null);
}
