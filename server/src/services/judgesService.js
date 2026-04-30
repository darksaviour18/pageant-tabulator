import { getDb } from '../db/init.js';

export const judgesService = {
  /**
   * Create a new judge for an event.
   * PIN stored as plain text (LAN-only event, no security risk).
   * @param {number} eventId
   * @param {{ seat_number: number, name: string, pin: string }} data
   * @returns {{id: number, event_id: number, seat_number: number, name: string}}
   */
  create(eventId, { seat_number, name, pin }) {
    const db = getDb();

    const result = db
      .prepare(
        'INSERT INTO judges (event_id, seat_number, name, pin) VALUES (?, ?, ?, ?)'
      )
      .run(eventId, seat_number, name, pin);

    return db
      .prepare('SELECT id, event_id, seat_number, name FROM judges WHERE id = ?')
      .get(result.lastInsertRowid);
  },

  /**
   * Get all judges for an event.
   * @param {number} eventId
   * @returns {Array}
   */
  getAll(eventId) {
    const db = getDb();
    return db
      .prepare(
        'SELECT id, event_id, seat_number, name, pin FROM judges WHERE event_id = ? ORDER BY seat_number'
      )
      .all(eventId);
  },

  /**
   * Get a single judge by ID.
   * @param {number} judgeId
   * @returns {object|undefined}
   */
  getById(judgeId) {
    const db = getDb();
    return db
      .prepare('SELECT id, event_id, seat_number, name FROM judges WHERE id = ?')
      .get(judgeId);
  },

  /**
   * Delete a judge by ID.
   * @param {number} judgeId
   */
  delete(judgeId) {
    const db = getDb();
    db.prepare('DELETE FROM judges WHERE id = ?').run(judgeId);
  },

  /**
   * Verify a judge's PIN (plain text comparison).
   * @param {number} judgeId
   * @param {string} pin
   * @returns {boolean}
   */
  verifyPin(judgeId, pin) {
    const db = getDb();
    const judge = db
      .prepare('SELECT id, pin FROM judges WHERE id = ?')
      .get(judgeId);
    if (!judge) return false;
    return judge.pin === pin;
  },
};
