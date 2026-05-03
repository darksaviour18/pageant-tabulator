import { useState, useCallback, useEffect, useRef } from 'react';
import { getScoresByJudgeAndCategory, saveScore, isCategorySubmitted } from '../db';

/**
 * Hook for managing offline score entries.
 *
 * @param {number} judgeId
 * @param {number} categoryId
 * @param {{ serverScores?: Array, onSync?: (scores: Array) => void, refetchKey?: number }} options
 */
export function useOfflineScores(judgeId, categoryId, { serverScores = [], onSync, refetchKey = 0 } = {}) {
  const [localScores, setLocalScores] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef(false); // 14.5: Abort flag for stale async loads

  // 14.5: Reset abort flag when refetchKey changes
  useEffect(() => {
    abortRef.current = false;
  }, [refetchKey]);

  useEffect(() => {
    // 14.5: Set abort flag for this load
    abortRef.current = false;

    const loadScores = async () => {
      setLoading(true);
      try {
        // 14.5: Check abort flag before async operations
        if (abortRef.current) return;

        const scores = await getScoresByJudgeAndCategory(judgeId, categoryId);

        if (abortRef.current) return; // Check again after async

        setLocalScores(scores);

        const submitted = await isCategorySubmitted(judgeId, categoryId);
        setIsSubmitted(submitted);
      } catch (err) {
        console.error('[useOfflineScores] Failed to load scores:', err);
      } finally {
        setLoading(false);
      }
    };
    loadScores();

    // 14.5: Cleanup - set abort flag on unmount/re-render
    return () => {
      abortRef.current = true;
    };
  }, [judgeId, categoryId, refetchKey]);

  /**
   * Save a score to IndexedDB and update local state.
   *
   * @param {number} contestantId
   * @param {number} criteriaId
   * @param {number} score
   * @returns {Promise<void>}
   */
  const saveLocalScore = useCallback(
    async (contestantId, criteriaId, score) => {
      try {
        await saveScore({ judgeId, contestantId, criteriaId, categoryId, score });
        setLocalScores((prev) => {
          const idx = prev.findIndex(
            (s) => s.contestantId === contestantId && s.criteriaId === criteriaId
          );
          const entry = { judgeId, contestantId, criteriaId, categoryId, score, synced: false };
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], score, synced: false };
            return next;
          }
          return [...prev, entry];
        });
      } catch (err) {
        console.error('[useOfflineScores] Failed to save score:', err);
      }
    },
    [judgeId, categoryId]
  );

  /**
   * Get the score for a specific contestant + criterion combo.
   * Merges server scores (source of truth) with local unsaved changes.
   */
  const getScore = useCallback(
    (contestantId, criteriaId) => {
      // Check local first (most recent)
      const local = localScores.find(
        (s) => s.contestantId === contestantId && s.criteriaId === criteriaId
      );
      // If local entry exists and score is not null/undefined, return it
      if (local !== undefined && local.score != null) {
        return local.score;
      }
      if (local !== undefined && local.score === null) {
        return null;
      }
      // No local entry - fall back to server scores
      const server = serverScores.find(
        (s) => s.contestant_id === contestantId && s.criteria_id === criteriaId
      );
      return server?.score ?? null;
    },
    [localScores, serverScores]
  );

  /**
   * Check if a specific cell has unsaved changes.
   */
  const isUnsaved = useCallback(
    (contestantId, criteriaId) => {
      const local = localScores.find(
        (s) => s.contestantId === contestantId && s.criteriaId === criteriaId
      );
      return !!local && !local.synced;
    },
    [localScores]
  );

  /**
   * Update local state immediately after a score change without writing to IndexedDB
   * (the write is handled by useAutoSave.saveAndSync). This keeps allFilled in sync
   * without waiting for the server round-trip.
   */
  const updateLocalScore = useCallback(
    (contestantId, criteriaId, score) => {
      setLocalScores((prev) => {
        const idx = prev.findIndex(
          (s) => s.contestantId === contestantId && s.criteriaId === criteriaId
        );
        const entry = { judgeId, contestantId, criteriaId, categoryId, score, synced: false };
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], score, synced: false };
          return next;
        }
        return [...prev, entry];
      });
    },
    [judgeId, categoryId]
  );

  return {
    localScores,
    isSubmitted,
    loading,
    saveLocalScore,
    updateLocalScore,
    getScore,
    isUnsaved,
  };
}
