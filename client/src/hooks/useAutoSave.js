import { useCallback, useRef, useEffect, useState } from 'react';
import { saveScore, markScoreSyncedByComposite, getUnsyncedScores, db } from '../db';
import { scoresAPI, scoringAPI } from '../api';
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
  const abortRef = useRef(false); // 14.5: Abort flag for stale async loads
  const { reconnectCount } = useSocket();
  const [conflict, setConflict] = useState(null); // { localCount, serverCount, onKeepLocal, onDiscardLocal }
  const [refetchKey, setRefetchKey] = useState(0); // Bump to signal ScoreSheet to re-fetch
  const [syncStatus, setSyncStatus] = useState({}); // Track which cells are syncing { "contestantId:criteriaId": true/false }

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

      // Build a set of indices that failed so we can skip them
      const failedIndices = new Set((res.data?.errors || []).map(e => e.index));

      // Mark only successfully saved entries as synced, and remove only them from the queue
      for (let i = 0; i < batch.length; i++) {
        if (failedIndices.has(i)) {
          // This entry failed — leave it in the queue for retry on next sync
          continue;
        }
        const entry = batch[i];
        const key = `${entry.contestant_id}:${entry.criteria_id}`;
        queueRef.current.delete(key);
        await markScoreSyncedByComposite(judgeId, entry.contestant_id, entry.criteria_id);
      }

      setSyncStatus({});
      setRefetchKey((k) => k + 1);
    } catch (err) {
      console.warn('[useAutoSave] Batch sync failed (network/server error):', err);
      // Queue is NOT cleared — all entries remain pending for retry
    } finally {
      syncingRef.current = false;
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
      // 14.5: Set abort flag on unmount to cancel stale operations
      abortRef.current = true;
    };
  }, []);

  // 10.1.3 + 10.1.4: On reconnect, check for conflicts then flush
  useEffect(() => {
    if (reconnectCount <= 0 || !judgeId || !eventId || !categoryId) return;

    // 14.5: Set abort flag for this connection attempt
    abortRef.current = false;

    const checkConflict = async () => {
      // 14.5: Check abort flag before async operations
      if (abortRef.current) {
        console.log('[useAutoSave] Aborted stale reconnect check');
        return;
      }

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

        // Collect differences with per-entry detail
        const diffs = [];
        for (const [key, localScore] of localMap) {
          const serverScore = serverMap.get(key);
          if (serverScore !== undefined && Math.abs(serverScore - localScore) > 0.01) {
            const [contestantId, criteriaId] = key.split(':').map(Number);
            diffs.push({ contestantId, criteriaId, localScore, serverScore });
          }
        }

        if (diffs.length > 0) {
          setConflict({
            localCount: localScores.length,
            serverCount: serverScores.length,
            diffs,
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
      // Only delete local scores that exist on the server.
      // Scores that are local-only (not yet synced) are preserved to avoid data loss.
      try {
        const res = await scoresAPI.getCategoryScores(judgeId, eventId, categoryId);
        const serverScores = res.data?.scores || [];
        const serverKeys = new Set(serverScores.map(s => `${s.contestant_id}:${s.criteria_id}`));
        const localScores = await db.scores.where({ judgeId, categoryId }).toArray();
        const toDelete = localScores
          .filter(s => serverKeys.has(`${s.contestantId}:${s.criteriaId}`))
          .map(s => s.id);
        if (toDelete.length > 0) {
          await db.scores.bulkDelete(toDelete);
        }
      } catch (err) {
        console.warn('[useAutoSave] Failed to fetch server scores for discard:', err);
        // Fall back to deleting all local scores for this category
        const localScores = await db.scores.where({ judgeId, categoryId }).toArray();
        await db.scores.bulkDelete(localScores.map(s => s.id));
      }
    }

    setConflict(null);
    setRefetchKey((k) => k + 1); // Trigger ScoreSheet to re-fetch from server
  }, [conflict, judgeId, categoryId, eventId]);

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
      
      // 3. Update sync status to trigger re-render and show animation
      setSyncStatus(prev => ({
        ...prev,
        [`${contestantId}:${criteriaId}`]: true
      }));
      
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
    isSyncing: (contestantId, criteriaId) => {
      // Check both queue (for immediate detection) and syncStatus state (for re-render)
      const inQueue = queueRef.current.has(`${contestantId}:${criteriaId}`);
      const inSyncStatus = syncStatus[`${contestantId}:${criteriaId}`] || false;
      return inQueue || inSyncStatus;
    },
    clearSyncStatus: () => setSyncStatus({}),
    conflict,
    resolveConflict,
    refetchKey,
  };
}

export default useAutoSave;

