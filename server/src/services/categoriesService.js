import { getDb } from '../db/init.js';

export const categoriesService = {
  /**
   * Create a new category for an event.
   * @param {number} eventId
   * @param {{ name: string, display_order: number, weight?: number }} data
   * @returns {object}
   */
  create(eventId, { name, display_order, weight = 1 }) {
    const db = getDb();
    const result = db
      .prepare(
        'INSERT INTO categories (event_id, name, display_order, weight) VALUES (?, ?, ?, ?)'
      )
      .run(eventId, name, display_order, weight);
    return db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
  },

  /**
   * Get all categories for an event.
   * @param {number} eventId
   * @returns {Array}
   */
  getAll(eventId) {
    const db = getDb();
    return db
      .prepare('SELECT * FROM categories WHERE event_id = ? ORDER BY display_order')
      .all(eventId);
  },

  /**
   * Get a single category by ID.
   * @param {number} id
   * @returns {object|undefined}
   */
  getById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  },

  /**
   * Update category fields.
   * @param {number} id
   * @param {{ name?: string, display_order?: number, is_locked?: boolean, weight?: number, required_round_id?: number|null }} data
   * @returns {object}
   */
  update(id, { name, display_order, is_locked, weight, required_round_id }) {
    const db = getDb();
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (display_order !== undefined) {
      updates.push('display_order = ?');
      values.push(display_order);
    }
    if (is_locked !== undefined) {
      updates.push('is_locked = ?');
      values.push(is_locked ? 1 : 0);
    }
    if (weight !== undefined) {
      updates.push('weight = ?');
      values.push(weight);
    }
    if (required_round_id !== undefined) {
      updates.push('required_round_id = ?');
      values.push(required_round_id !== null ? Number(required_round_id) : null);
    }

    if (updates.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(id);
    db.prepare(`UPDATE categories SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    return this.getById(id);
  },

  /**
   * Delete a category and its criteria (cascade).
   * @param {number} id
   */
  delete(id) {
    const db = getDb();
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  },
};
