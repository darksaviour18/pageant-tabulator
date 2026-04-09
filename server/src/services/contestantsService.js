import { getDb } from '../db/init.js';

export const contestantsService = {
  /**
   * Create a new contestant for an event.
   * @param {number} eventId
   * @param {{ number: number, name: string }} data
   * @returns {object}
   */
  create(eventId, { number, name }) {
    const db = getDb();
    const result = db
      .prepare('INSERT INTO contestants (event_id, number, name) VALUES (?, ?, ?)')
      .run(eventId, number, name);
    return db.prepare('SELECT * FROM contestants WHERE id = ?').get(result.lastInsertRowid);
  },

  /**
   * Get all contestants for an event.
   * @param {number} eventId
   * @returns {Array}
   */
  getAll(eventId) {
    const db = getDb();
    return db
      .prepare('SELECT * FROM contestants WHERE event_id = ? ORDER BY number')
      .all(eventId);
  },

  /**
   * Get a single contestant by ID.
   * @param {number} id
   * @returns {object|undefined}
   */
  getById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM contestants WHERE id = ?').get(id);
  },

  /**
   * Update contestant fields.
   * @param {number} id
   * @param {{ name?: string, status?: string }} data
   * @returns {object}
   */
  update(id, { name, status }) {
    const db = getDb();
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }

    if (updates.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(id);
    db.prepare(
      `UPDATE contestants SET ${updates.join(', ')} WHERE id = ?`
    ).run(...values);

    return this.getById(id);
  },

  /**
   * Soft-delete a contestant (set status to withdrawn).
   * @param {number} id
   */
  softDelete(id) {
    const db = getDb();
    db.prepare("UPDATE contestants SET status = 'withdrawn' WHERE id = ?").run(id);
  },
};
