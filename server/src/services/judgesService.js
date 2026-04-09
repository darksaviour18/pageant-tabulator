import { getDb } from '../db/init.js';
import bcrypt from 'bcrypt';

export const judgesService = {
  /**
   * Create a new judge for an event.
   * @param {number} eventId
   * @param {{ seat_number: number, name: string, pin: string }} data
   * @returns {Promise<{id: number, event_id: number, seat_number: number, name: string}>}
   */
  async create(eventId, { seat_number, name, pin }) {
    const db = getDb();
    const pinHash = await bcrypt.hash(pin, 10);

    const result = db
      .prepare(
        'INSERT INTO judges (event_id, seat_number, name, pin_hash) VALUES (?, ?, ?, ?)'
      )
      .run(eventId, seat_number, name, pinHash);

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
        'SELECT id, event_id, seat_number, name FROM judges WHERE event_id = ? ORDER BY seat_number'
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
   * Verify a judge's PIN.
   * @param {number} judgeId
   * @param {string} pin
   * @returns {Promise<boolean>}
   */
  async verifyPin(judgeId, pin) {
    const db = getDb();
    const judge = db
      .prepare('SELECT id, pin_hash FROM judges WHERE id = ?')
      .get(judgeId);
    if (!judge) return false;
    return bcrypt.compare(pin, judge.pin_hash);
  },
};
