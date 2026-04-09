import { getDb } from '../db/init.js';

export const eventsService = {
  /**
   * Create a new event.
   * @param {string} name
   * @returns {{ id: number, name: string, created_at: string, status: string }}
   */
  create(name) {
    const db = getDb();
    const result = db
      .prepare('INSERT INTO events (name, status) VALUES (?, ?)')
      .run(name, 'active');
    return db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid);
  },

  /**
   * Get all events.
   * @returns {Array}
   */
  getAll() {
    const db = getDb();
    return db.prepare('SELECT * FROM events ORDER BY created_at DESC').all();
  },

  /**
   * Get a single event by ID.
   * @param {number} id
   * @returns {object|undefined}
   */
  getById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM events WHERE id = ?').get(id);
  },

  /**
   * Get event with nested relations (judges, contestants, categories+criteria).
   * @param {number} id
   * @returns {object|null}
   */
  getByIdWithRelations(id) {
    const db = getDb();
    const event = this.getById(id);
    if (!event) return null;

    return {
      ...event,
      judges: db
        .prepare(
          'SELECT id, event_id, seat_number, name FROM judges WHERE event_id = ? ORDER BY seat_number'
        )
        .all(id),
      contestants: db
        .prepare('SELECT * FROM contestants WHERE event_id = ? ORDER BY number')
        .all(id),
      categories: this.getCategoriesWithCriteria(id),
    };
  },

  /**
   * Get all categories for an event with their criteria nested.
   * @param {number} eventId
   * @returns {Array}
   */
  getCategoriesWithCriteria(eventId) {
    const db = getDb();
    const categories = db
      .prepare(
        'SELECT * FROM categories WHERE event_id = ? ORDER BY display_order'
      )
      .all(eventId);

    return categories.map((cat) => ({
      ...cat,
      criteria: db
        .prepare(
          'SELECT id, name, weight, min_score, max_score, display_order FROM criteria WHERE category_id = ? ORDER BY display_order'
        )
        .all(cat.id),
    }));
  },

  /**
   * Update event fields.
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
      `UPDATE events SET ${updates.join(', ')} WHERE id = ?`
    ).run(...values);

    return this.getById(id);
  },
};
