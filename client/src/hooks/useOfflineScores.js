import { useState, useCallback, useEffect } from 'react';
import { getScoresByJudgeAndCategory, saveScore, isCategorySubmitted } from '../db';

/**
 * Hook for managing offline score entries.
 *
 * @param {number} judgeId
 * @param {number} categoryId
 * @param {{ serverScores?: Array, onSync?: (scores: Array) => void }} options
 */
export function useOfflineScores(judgeId, categoryId, { serverScores = [], onSync, refetchKey = 0 } = {}) {
  const [localScores, setLocalScores] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadScores = async () => {
      setLoading(true);
      try {
        const scores = await getScoresByJudgeAndCategory(judgeId, categoryId);
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
      if (local) return local.score;

      // Fall back to server scores
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

  return {
    localScores,
    isSubmitted,
    loading,
    saveLocalScore,
    getScore,
    isUnsaved,
  };
}
