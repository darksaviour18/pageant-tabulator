import { useCallback, useRef, useEffect, useState } from 'react';
import { saveScore, markScoreSynced, getUnsyncedScores, db } from '../db';
import { scoresAPI } from '../api';
import { useSocket } from '../context/SocketContext';

const SYNC_DEBOUNCE_MS = 250;

/**
 * Hook that manages auto-save of score entries.
 *
 * Flow on score change:
 *   1. Save to IndexedDB immediately (offline-first)
 *   2. Debounce 250ms → batch POST to server
 *   3. On success → mark as synced
 *
 * On reconnect:
 *   1. Fetch server scores for this category
 *   2. Compare with local scores
 *   3. If conflict, set conflict state for modal
 *
 * @param {{ judgeId: number, eventId: number, categoryId: number }} params
 * @returns {{ syncQueue: Map, syncNow: () => Promise<void>, conflict, resolveConflict }}
 */
export function useAutoSave({ judgeId, eventId, categoryId }) {
  const queueRef = useRef(new Map()); // key: "contestantId:criteriaId" → score
  const timerRef = useRef(null);
  const syncingRef = useRef(false);
  const { reconnectCount } = useSocket();
  const [conflict, setConflict] = useState(null); // { localCount, serverCount, onKeepLocal, onDiscardLocal }
  const [refetchKey, setRefetchKey] = useState(0); // Bump to signal ScoreSheet to re-fetch

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

  // 10.1.3 + 10.1.4: On reconnect, check for conflicts then flush
  useEffect(() => {
    if (reconnectCount <= 0 || !judgeId || !eventId || !categoryId) return;

    const checkConflict = async () => {
      try {
        // Get local scores
        const localScores = await db.scores.where({ judgeId, categoryId }).toArray();
        if (localScores.length === 0) {
          // No local scores, just flush any pending queue
          if (queueRef.current.size > 0) flushQueue();
          return;
        }

        // Fetch server scores
        const res = await scoresAPI.getCategoryScores(judgeId, eventId, categoryId);
        const serverScores = res.data?.scores || [];

        // Compare: build sets of (contestantId, criteriaId) → score
        const localMap = new Map(localScores.map(s => [`${s.contestantId}:${s.criteriaId}`, s.score]));
        const serverMap = new Map(serverScores.map(s => [`${s.contestant_id}:${s.criteria_id}`, s.score]));

        // Check for differences
        let hasConflict = false;
        for (const [key, localScore] of localMap) {
          const serverScore = serverMap.get(key);
          if (serverScore !== undefined && Math.abs(serverScore - localScore) > 0.01) {
            hasConflict = true;
            break;
          }
        }

        if (hasConflict) {
          setConflict({
            localCount: localScores.length,
            serverCount: serverScores.length,
          });
        } else if (queueRef.current.size > 0) {
          flushQueue();
        }
      } catch (err) {
        console.warn('[useAutoSave] Conflict check failed:', err);
        // Still try to flush pending scores
        if (queueRef.current.size > 0) flushQueue();
      }
    };

    checkConflict();
  }, [reconnectCount, judgeId, eventId, categoryId, flushQueue]);

  /**
   * Resolve a conflict: keep local scores (overwrite server) or discard local.
   */
  const resolveConflict = useCallback(async (action) => {
    if (!conflict) return;

    if (action === 'keep-local') {
      // Overwrite server with local scores
      const localScores = await db.scores.where({ judgeId, categoryId }).toArray();
      const batch = localScores.filter(s => s.score != null).map(s => ({
        judge_id: s.judgeId,
        contestant_id: s.contestantId,
        criteria_id: s.criteriaId,
        category_id: s.categoryId,
        score: s.score,
      }));

      if (batch.length > 0) {
        try {
          await scoresAPI.batchSubmitScores(batch);
          // Mark all as synced
          for (const s of localScores) {
            if (!s.synced) await db.scores.update(s.id, { synced: true });
          }
        } catch (err) {
          console.warn('[useAutoSave] Failed to push local scores to server:', err);
        }
      }
    } else if (action === 'discard-local') {
      // Clear local scores for this category, they'll be re-fetched from server
      const localScores = await db.scores.where({ judgeId, categoryId }).toArray();
      await db.scores.bulkDelete(localScores.map(s => s.id));
    }

    setConflict(null);
    setRefetchKey((k) => k + 1); // Trigger ScoreSheet to re-fetch from server
  }, [conflict, judgeId, categoryId]);

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
    conflict,
    resolveConflict,
    refetchKey,
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
