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

    const scoreCount = db.prepare('SELECT COUNT(*) as cnt FROM scores WHERE event_id = ?').get(id).cnt;

    return {
      ...event,
      has_scores: scoreCount > 0,
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
   * @param {{ name?: string, status?: string, tabulators?: string, scoring_mode?: string }} data
   * @returns {object}
   */
  update(id, { name, status, tabulators, scoring_mode }) {
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
    if (tabulators !== undefined) {
      updates.push('tabulators = ?');
      values.push(tabulators);
    }
    if (scoring_mode !== undefined) {
      updates.push('scoring_mode = ?');
      values.push(scoring_mode);
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

  /**
   * Delete an event and all related data.
   * @param {number} id
   */
  delete(id) {
    const db = getDb();
    const event = this.getById(id);
    if (!event) {
      throw new Error('Event not found');
    }

    db.transaction(() => {
      // Delete scores first (references judges, contestants, criteria)
      db.prepare('DELETE FROM scores WHERE event_id = ?').run(id);

      // Delete elimination rounds
      db.prepare('DELETE FROM elimination_rounds WHERE event_id = ?').run(id);

      // Delete criteria (references categories)
      db.prepare(`
        DELETE FROM criteria WHERE category_id IN (
          SELECT id FROM categories WHERE event_id = ?
        )
      `).run(id);

      // Delete categories
      db.prepare('DELETE FROM categories WHERE event_id = ?').run(id);

      // Delete judges
      db.prepare('DELETE FROM judges WHERE event_id = ?').run(id);

      // Delete contestants
      db.prepare('DELETE FROM contestants WHERE event_id = ?').run(id);

      // Finally delete the event
      db.prepare('DELETE FROM events WHERE id = ?').run(id);
    })();

    return { success: true };
  },
};
