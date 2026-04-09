import Dexie from 'dexie';

/**
 * IndexedDB wrapper for offline-first score entry.
 *
 * Mirrors the server-side scores and category_submissions schemas
 * per SPEC.md §5.3 Offline & Synchronization.
 */
export const db = new Dexie('PageantTabulatorDB');

db.version(1).stores({
  // Composite primary keys for uniqueness
  scores: '++id, [judgeId+contestantId+criteriaId], synced, updatedAt',
  submissions: '++id, [judgeId+categoryId], synced, submittedAt',
});

/**
 * Save or update a score in IndexedDB.
 * Upserts by matching [judgeId, contestantId, criteriaId].
 *
 * @param {{ judgeId: number, contestantId: number, criteriaId: number, categoryId: number, score: number }} data
 * @returns {Promise<number>} The saved score's ID
 */
export async function saveScore({ judgeId, contestantId, criteriaId, categoryId, score }) {
  const existing = await db.scores
    .where('[judgeId+contestantId+criteriaId]')
    .equals([judgeId, contestantId, criteriaId])
    .first();

  if (existing) {
    await db.scores.update(existing.id, { score, synced: false, updatedAt: Date.now() });
    return existing.id;
  }

  return db.scores.add({
    judgeId,
    contestantId,
    criteriaId,
    categoryId,
    score,
    synced: false,
    updatedAt: Date.now(),
  });
}

/**
 * Get all scores for a specific judge + category combo.
 *
 * @param {number} judgeId
 * @param {number} categoryId
 * @returns {Promise<Array>}
 */
export async function getScoresByJudgeAndCategory(judgeId, categoryId) {
  return db.scores.where({ judgeId, categoryId }).toArray();
}

/**
 * Get all unsynced scores (for batch upload on reconnect).
 *
 * @returns {Promise<Array>}
 */
export async function getUnsyncedScores() {
  return db.scores.where('synced').equals(0).toArray();
}

/**
 * Mark a score as synced (after successful server POST).
 *
 * @param {number} id
 */
export async function markScoreSynced(id) {
  await db.scores.update(id, { synced: true });
}

/**
 * Mark scores as submitted for a judge + category.
 *
 * @param {{ judgeId: number, categoryId: number }} data
 * @returns {Promise<number>}
 */
export async function markCategorySubmitted({ judgeId, categoryId }) {
  return db.submissions.add({
    judgeId,
    categoryId,
    submitted: true,
    synced: false,
    submittedAt: Date.now(),
  });
}

/**
 * Check if a judge has submitted a category.
 *
 * @param {number} judgeId
 * @param {number} categoryId
 * @returns {Promise<boolean>}
 */
export async function isCategorySubmitted(judgeId, categoryId) {
  const sub = await db.submissions
    .where('[judgeId+categoryId]')
    .equals([judgeId, categoryId])
    .first();
  return !!sub?.submitted;
}

/**
 * Get all unsynced submissions.
 *
 * @returns {Promise<Array>}
 */
export async function getUnsyncedSubmissions() {
  return db.submissions.where('synced').equals(0).toArray();
}

/**
 * Mark a submission as synced.
 *
 * @param {number} id
 */
export async function markSubmissionSynced(id) {
  await db.submissions.update(id, { synced: true });
}

/**
 * Clear all data for a judge (on logout).
 *
 * @param {number} judgeId
 */
export async function clearJudgeData(judgeId) {
  const scoreIds = (await db.scores.where({ judgeId }).toArray()).map((s) => s.id);
  await db.scores.bulkDelete(scoreIds);

  const subIds = (await db.submissions.where({ judgeId }).toArray()).map((s) => s.id);
  await db.submissions.bulkDelete(subIds);
}
