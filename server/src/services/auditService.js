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

/**
 * Get audit logs for an event.
 *
 * @param {number} eventId
 * @param {{ limit?: number, offset?: number, action?: string }} options
 * @returns {Array}
 */
export function getAuditLogs(eventId, { limit = 100, offset = 0, action } = {}) {
  const db = getDb();
  let query = `
    SELECT al.*, j.name as judge_name
    FROM audit_log al
    LEFT JOIN judges j ON al.judge_id = j.id
    WHERE al.event_id = ?
  `;
  const params = [eventId];

  if (action) {
    query += ' AND al.action = ?';
    params.push(action);
  }

  query += ' ORDER BY al.timestamp DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const logs = db.prepare(query).all(...params);
  return logs.map(log => ({
    ...log,
    details: log.details ? JSON.parse(log.details) : null,
  }));
}
