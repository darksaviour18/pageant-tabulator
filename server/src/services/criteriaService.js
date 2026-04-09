import { getDb } from '../db/init.js';

export const criteriaService = {
  /**
   * Create a new criterion for a category.
   * @param {number} categoryId
   * @param {{ name: string, weight: number, min_score: number, max_score: number, display_order: number }} data
   * @returns {object}
   */
  create(categoryId, { name, weight, min_score = 0, max_score = 10, display_order }) {
    const db = getDb();
    const result = db
      .prepare(
        'INSERT INTO criteria (category_id, name, weight, min_score, max_score, display_order) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(categoryId, name, weight, min_score, max_score, display_order);
    return db.prepare('SELECT * FROM criteria WHERE id = ?').get(result.lastInsertRowid);
  },

  /**
   * Get all criteria for a category.
   * @param {number} categoryId
   * @returns {Array}
   */
  getAll(categoryId) {
    const db = getDb();
    return db
      .prepare('SELECT * FROM criteria WHERE category_id = ? ORDER BY display_order')
      .all(categoryId);
  },

  /**
   * Get a single criterion by ID.
   * @param {number} id
   * @returns {object|undefined}
   */
  getById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM criteria WHERE id = ?').get(id);
  },

  /**
   * Update criterion fields.
   * @param {number} id
   * @param {{ name?: string, weight?: number, min_score?: number, max_score?: number, display_order?: number }} data
   * @returns {object}
   */
  update(id, { name, weight, min_score, max_score, display_order }) {
    const db = getDb();
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (weight !== undefined) {
      updates.push('weight = ?');
      values.push(weight);
    }
    if (min_score !== undefined) {
      updates.push('min_score = ?');
      values.push(min_score);
    }
    if (max_score !== undefined) {
      updates.push('max_score = ?');
      values.push(max_score);
    }
    if (display_order !== undefined) {
      updates.push('display_order = ?');
      values.push(display_order);
    }

    if (updates.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(id);
    db.prepare(`UPDATE criteria SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    return this.getById(id);
  },

  /**
   * Delete a criterion by ID.
   * @param {number} id
   */
  delete(id) {
    const db = getDb();
    db.prepare('DELETE FROM criteria WHERE id = ?').run(id);
  },

  /**
   * Get total weight for a category's criteria.
   * @param {number} categoryId
   * @returns {number}
   */
  getTotalWeight(categoryId) {
    const db = getDb();
    const row = db
      .prepare('SELECT COALESCE(SUM(weight), 0) as total FROM criteria WHERE category_id = ?')
      .get(categoryId);
    return row.total;
  },
};
