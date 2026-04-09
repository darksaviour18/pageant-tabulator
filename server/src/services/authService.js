import { getDb } from '../db/init.js';
import bcrypt from 'bcrypt';

export const authService = {
  /**
   * Authenticate a judge by seat number + PIN.
   * Returns the judge object (without pin_hash) or null.
   *
   * @param {number} eventId
   * @param {number} seatNumber
   * @param {string} pin
   * @returns {Promise<{ id: number, event_id: number, seat_number: number, name: string }|null>}
   */
  async authenticateJudge(eventId, seatNumber, pin) {
    const db = getDb();

    const judge = db
      .prepare(
        'SELECT id, event_id, seat_number, name, pin_hash FROM judges WHERE event_id = ? AND seat_number = ?'
      )
      .get(eventId, seatNumber);

    if (!judge) return null;

    const valid = await bcrypt.compare(pin, judge.pin_hash);
    if (!valid) return null;

    // Return without pin_hash
    const { pin_hash: _omit, ...safeJudge } = judge;
    return safeJudge;
  },
};
