import { useCallback, useRef, useEffect } from 'react';
import { saveScore, markScoreSynced, db } from '../db';
import { scoresAPI } from '../api';

const SYNC_DEBOUNCE_MS = 250;

/**
 * Hook that manages auto-save of score entries.
 *
 * Flow on score change:
 *   1. Save to IndexedDB immediately (offline-first)
 *   2. Debounce 250ms → batch POST to server
 *   3. On success → mark as synced
 *
 * @param {{ judgeId: number, categoryId: number }} params
 * @returns {{ syncQueue: Map, syncNow: () => Promise<void> }}
 */
export function useAutoSave({ judgeId, categoryId }) {
  const queueRef = useRef(new Map()); // key: "contestantId:criteriaId" → score
  const timerRef = useRef(null);
  const syncingRef = useRef(false);

  const flushQueue = useCallback(async () => {
    if (queueRef.current.size === 0 || syncingRef.current) return;

    syncingRef.current = true;
    const batch = Array.from(queueRef.current.entries()).map(([key, value]) => {
      const [contestantId, criteriaId] = key.split(':').map(Number);
      return {
        judge_id: judgeId,
        contestant_id: contestantId,
        criteria_id: criteriaId,
        category_id: categoryId,
        score: value,
      };
    });

    try {
      const res = await scoresAPI.batchSubmitScores(batch);
      if (res.data?.saved) {
        // Mark synced for each successfully saved score
        for (const entry of batch) {
          // We don't have the IndexedDB ID here, so we mark by composite key
          await markScoreSyncedByComposite(
            judgeId,
            entry.contestant_id,
            entry.criteria_id
          );
        }
      }
    } catch (err) {
      console.warn('[useAutoSave] Batch sync failed, will retry on next change:', err);
    } finally {
      syncingRef.current = false;
      queueRef.current.clear();
    }
  }, [judgeId, categoryId]);

  const scheduleSync = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flushQueue, SYNC_DEBOUNCE_MS);
  }, [flushQueue]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  /**
   * Save a score: write to IndexedDB immediately, queue for server sync.
   */
  const saveAndSync = useCallback(
    async (contestantId, criteriaId, score) => {
      // 1. Save to IndexedDB immediately
      const dbId = await saveScore({
        judgeId,
        contestantId,
        criteriaId,
        categoryId,
        score,
      });

      // 2. Queue for debounced server sync
      queueRef.current.set(`${contestantId}:${criteriaId}`, score);
      scheduleSync();

      return dbId;
    },
    [judgeId, categoryId, scheduleSync]
  );

  /**
   * Force flush all pending scores now.
   */
  const syncNow = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await flushQueue();
  }, [flushQueue]);

  return {
    saveAndSync,
    syncNow,
    getPendingCount: () => queueRef.current.size,
  };
}

/**
 * Mark a score as synced by looking up via composite key.
 * Dexie doesn't support compound unique indexes well, so we find by fields.
 */
async function markScoreSyncedByComposite(judgeId, contestantId, criteriaId) {
  const match = await db.scores
    .where({ judgeId, contestantId, criteriaId })
    .first();
  if (match && !match.synced) {
    await db.scores.update(match.id, { synced: true });
  }
}
