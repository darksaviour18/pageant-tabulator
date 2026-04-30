import { getDb } from '../db/init.js';

export const authService = {
  /**
   * Authenticate a judge by seat number + PIN (plain text comparison).
   * Returns the judge object or null.
   *
   * @param {number} eventId
   * @param {number} seatNumber
   * @param {string} pin
   * @returns {{ id: number, event_id: number, seat_number: number, name: string }|null}
   */
  authenticateJudge(eventId, seatNumber, pin) {
    const db = getDb();

    const judge = db
      .prepare(
        'SELECT id, event_id, seat_number, name, pin FROM judges WHERE event_id = ? AND seat_number = ?'
      )
      .get(eventId, seatNumber);

    if (!judge) return null;
    if (judge.pin !== pin) return null;

    // Return without pin
    const { pin: _omit, ...safeJudge } = judge;
    return safeJudge;
  },
};
