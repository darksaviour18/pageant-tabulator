import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, ChevronRight, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { getJudgeSession, clearJudgeSession } from '../utils/session';
import { scoringAPI, submissionsAPI, scoresAPI } from '../api';
import { markCategoryUnlocked } from '../db';
import ScoreSheet from '../components/ScoreSheet';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';

export default function JudgeDashboard() {
  const navigate = useNavigate();
  const { onEvent, connected, lastSync } = useSocket();
  const { isDark } = useTheme();
  const [session, setSession] = useState(null);
  const [scoringData, setScoringData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [submittedCategories, setSubmittedCategories] = useState(new Set());
  const [unlockedCategory, setUnlockedCategory] = useState(null);
  const [categoryScores, setCategoryScores] = useState([]);
  const [loadingScores, setLoadingScores] = useState(false);
  const [categoryScoreCounts, setCategoryScoreCounts] = useState({}); // { categoryId: { scored, total } }
  const [allScores, setAllScores] = useState([]); // All scores for progress bars
  const unlockedTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    const s = getJudgeSession();
    if (!s) {
      navigate('/judge/login');
      return;
    }
    setSession(s);
    loadScoringContext(s.judgeId, s.eventId);
    
    // Cleanup: abort in-flight request on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [navigate]);

  // Fetch all scores for progress bars (independent of category selection)
  useEffect(() => {
    if (!session) return;
    
    const fetchAllScores = async () => {
      try {
        const res = await scoresAPI.getAllByJudge(session.judgeId);
        setAllScores(res.data || []);
      } catch (err) {
        console.error('Failed to load all scores:', err);
      }

      // 10.2.7: Initialize submitted categories from server
      try {
        console.log('[DEBUG] Fetching submitted categories for judge:', session.judgeId, 'event:', session.eventId);
        const subRes = await submissionsAPI.getByJudgeAndEvent(session.judgeId, session.eventId);
        console.log('[DEBUG] Submitted categories API response:', subRes.data);
        if (subRes.data?.submittedCategories) {
          setSubmittedCategories(new Set(subRes.data.submittedCategories));
          console.log('[DEBUG] Set submittedCategories to:', subRes.data.submittedCategories);
        }
        // If any categories are already unlocked by admin, set unlockedCategory
        if (subRes.data?.unlockedCategories?.length > 0) {
          setUnlockedCategory(subRes.data.unlockedCategories[0]);
        }
      } catch (err) {
        console.error('Failed to load submission status:', err);
      }
    };
    
    fetchAllScores();
  }, [session]);

  // Listen for admin unlock notifications
  useEffect(() => {
    const unsub = onEvent('sheet_unlocked', (data) => {
      setUnlockedCategory(data.categoryId);
      // Keep IndexedDB in sync so isCategorySubmitted() returns false after unlock
      if (session?.judgeId) {
        markCategoryUnlocked(session.judgeId, data.categoryId).catch(err =>
          console.error('[JudgeDashboard] Failed to update IndexedDB on unlock:', err)
        );
      }
      // If currently viewing this category, re-select to refresh
      if (selectedCategory?.id === data.categoryId) {
        setSelectedCategory((prev) => prev ? { ...prev, _unlocked: true } : null);
      }
      // Auto-clear notification after 5s (clean up previous timeout)
      if (unlockedTimeoutRef.current) clearTimeout(unlockedTimeoutRef.current);
      unlockedTimeoutRef.current = setTimeout(() => setUnlockedCategory(null), 5000);
    });

    // Cleanup timeout on unmount
    return () => {
      unsub();
      if (unlockedTimeoutRef.current) clearTimeout(unlockedTimeoutRef.current);
    };
  }, [onEvent, selectedCategory]);

  const loadScoringContext = async (judgeId, eventId) => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    try {
      const res = await scoringAPI.getContext(judgeId, eventId, {
        signal: abortControllerRef.current.signal
      });
      setScoringData(res.data);
    } catch (err) {
      if (err.name === 'AbortError') return; // Ignore aborted requests
      setError(err.response?.data?.error || 'Failed to load scoring data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearJudgeSession();
    navigate('/judge/login');
  };

  const handleSelectCategory = async (cat) => {
    setSelectedCategory(cat);
    setLoadingScores(true);
    try {
      const res = await scoringAPI.getCategoryScores(session.judgeId, session.eventId, cat.id);
      setCategoryScores(res.data.scores || []);

      // 10.2.7: Track submitted status from API response
      if (res.data.submitted) {
        setSubmittedCategories(prev => new Set([...prev, cat.id]));
      }

      // 10.2.6: Track score count for this category
      const total = (scoringData.contestants?.length || 0) * (cat.criteria?.length || 0);
      // Count only non-null scores (not empty)
      const scoredCount = (res.data.scores || []).filter(s => s.score != null && s.score !== '').length;
      setCategoryScoreCounts((prev) => ({
        ...prev,
        [cat.id]: { scored: scoredCount, total },
      }));
    } catch (err) {
      console.error('Failed to load category scores:', err);
      setCategoryScores([]);
    } finally {
      setLoadingScores(false);
    }
  };

  const handleBackToCategories = () => {
    setSelectedCategory(null);
    setCategoryScores([]);
  };

  const handleContestantsChange = async () => {
    // Refetch scoring context to get updated contestants list
    if (!session) return;
    try {
      const res = await scoringAPI.getContext(session.judgeId, session.eventId);
      setScoringData(res.data);
    } catch (err) {
      console.error('Failed to refresh contestants:', err);
    }
  };

  // Update progress bar in real-time when scores change
  const handleScoreChange = useCallback((hasScore) => {
    if (!selectedCategory) return;
    setCategoryScoreCounts((prev) => {
      const current = prev[selectedCategory.id] || { scored: 0, total: 0 };
      const newScored = current.scored + (hasScore ? 1 : -1);
      return {
        ...prev,
        [selectedCategory.id]: {
          ...current,
          scored: Math.max(0, newScored),
        },
      };
    });
  }, [selectedCategory]);

  // Update allScores when score is saved (for real-time progress updates)
  const handleScoreSaved = useCallback((contestantId, criteriaId, categoryId, score) => {
    setAllScores((prev) => {
      const existing = prev.find(
        s => s.contestant_id === contestantId && s.criteria_id === criteriaId && s.category_id === categoryId
      );
      if (existing) {
        // Update existing
        return prev.map(s => 
          s.contestant_id === contestantId && s.criteria_id === criteriaId && s.category_id === categoryId
            ? { ...s, score, updated_at: new Date().toISOString() }
            : s
        );
      } else {
        // Add new
        return [...prev, { contestant_id: contestantId, criteria_id: criteriaId, category_id: categoryId, score }];
      }
    });
  }, []);

  const handleSubmitCategory = async () => {
    if (!session || !selectedCategory) return;

    // Validate all scores are filled
    const totalCells = (scoringData.contestants?.length || 0) * (selectedCategory.criteria?.length || 0);
    const scoredCells = categoryScoreCounts[selectedCategory.id]?.scored || 0;

    if (scoredCells < totalCells) {
      setError(`Please complete all ${totalCells} score fields before submitting. You have ${scoredCells} of ${totalCells} complete.`);
      return;
    }

    try {
      await submissionsAPI.submitCategory(session.judgeId, selectedCategory.id);
      setSubmittedCategories((prev) => new Set([...prev, selectedCategory.id]));
      setSelectedCategory(null); // Return to category list
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit category');
    }
  };

  if (!session || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-[var(--color-text-muted)] text-lg">Loading...</div>
      </div>
    );
  }

  // Show spreadsheet if a category is selected
  if (selectedCategory && scoringData) {
    const timeSinceSync = lastSync ? `${Math.max(1, Math.floor((Date.now() - lastSync) / 1000))}s ago` : 'never';
    return (
      <div className="space-y-4">
        {/* Offline banner */}
        {!connected && (
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 px-4 py-3 rounded-lg flex items-center gap-2 text-sm font-medium">
            <WifiOff className="w-4 h-4" />
            Working offline. Scores saved locally.
          </div>
        )}

        {/* Compact header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-[var(--color-text)]">
              {session.eventName}
            </h1>
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]" title={`Last sync: ${timeSinceSync}`}>
              {connected ? <Wifi className="w-3.5 h-3.5 text-green-500" /> : <WifiOff className="w-3.5 h-3.5 text-red-500" />}
              <span>{connected ? 'Connected' : 'Disconnected'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-muted)] opacity-40">Pageant Tabulator</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>

        {loadingScores ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-[var(--color-text-muted)] text-lg">Loading scores...</div>
          </div>
        ) : (
          <ScoreSheet
            judgeId={session.judgeId}
            eventId={session.eventId}
            category={selectedCategory}
            contestants={scoringData.contestants}
            serverScores={categoryScores}
            isSubmitted={submittedCategories.has(selectedCategory.id)}
            isUnlocked={selectedCategory.id === unlockedCategory || selectedCategory._unlocked}
            onBack={handleBackToCategories}
            onSubmit={handleSubmitCategory}
            onContestantsChange={handleContestantsChange}
            onScoreChange={handleScoreChange}
            onScoreSaved={handleScoreSaved}
          />
        )}
      </div>
    );
  }

  // Category selection view
  const timeSinceSync = lastSync ? `${Math.max(1, Math.floor((Date.now() - lastSync) / 1000))}s ago` : 'never';
  return (
    <div className="space-y-4">
      {/* Header - Event focus */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">
            {session.eventName}
          </h1>
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] mt-1">
            <span>Judge {session.judgeName}</span>
            <span className="text-[var(--color-text-muted)]/30">·</span>
            <span className="flex items-center gap-1.5" title={`Last sync: ${timeSinceSync}`}>
              {connected ? <Wifi className="w-3.5 h-3.5 text-green-500" /> : <WifiOff className="w-3.5 h-3.5 text-red-500" />}
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-1 opacity-40">
            Pageant Tabulator
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>

      {/* Offline banner */}
      {!connected && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 px-4 py-3 rounded-lg flex items-center gap-2 text-sm font-medium">
          <WifiOff className="w-4 h-4" />
          Working offline. Scores saved locally.
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-500 bg-red-500/10 px-4 py-3 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Unlock Notification Banner */}
      {unlockedCategory && scoringData && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 px-4 py-3 rounded-lg flex items-center gap-2 animate-pulse">
          <AlertCircle className="w-4 h-4" />
          <span className="font-medium">
            Admin has unlocked{' '}
            "{scoringData.categories.find((c) => c.id === unlockedCategory)?.name || 'a category'}".
            You can now edit scores.
          </span>
        </div>
      )}

      {/* Category Cards */}
      {scoringData?.categories?.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {scoringData.categories.map((cat) => {
            const criteriaCount = cat.criteria?.length || 0;
            const totalCells = (scoringData.contestants?.length || 0) * criteriaCount;
            const isLocked = cat.is_locked;
            const isSubmitted = submittedCategories.has(cat.id);
            // Get scored count from all scores (fetched on mount)
            const categoryScores = allScores.filter(s => s.category_id === cat.id && s.score != null && s.score !== '');
            const scored = categoryScores.length;
            const hasScores = scored > 0;

            return (
              <button
                key={cat.id}
                onClick={() => handleSelectCategory(cat)}
                disabled={isLocked}
                aria-label={`${cat.name}: ${isSubmitted ? 'Submitted' : isLocked ? 'Locked' : hasScores ? `Draft ${Math.round((scored / totalCells) * 100)}%` : 'Not started'}`}
                className={`text-left p-4 sm:p-5 min-h-[80px] rounded-xl border-2 transition-all touch-manipulation ${
                  isSubmitted
                    ? 'border-green-500/30 bg-green-500/10 cursor-pointer hover:shadow-md active:scale-[0.98]'
                    : isLocked
                    ? 'border-[var(--color-border)] bg-[var(--color-bg-subtle)] cursor-not-allowed opacity-60'
                    : 'border-[var(--color-border)] hover:border-[var(--color-cta)] hover:shadow-md bg-[var(--color-bg-subtle)] active:scale-[0.98]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-[var(--color-text)]">{cat.name}</h3>
                  {isSubmitted ? (
                    <span className="text-green-500 text-xs font-medium">✓ Submitted (View)</span>
                  ) : isLocked ? (
                    <span className="text-[var(--color-text-muted)] text-xs font-medium">🔒 Locked</span>
                  ) : hasScores && totalCells > 0 ? (
                    <div className="flex items-center gap-2">
                      {(() => {
                        const percent = Math.round((scored / totalCells) * 100);
                        const getColor = (p) => {
                          if (p >= 100) return 'bg-green-500';
                          if (p >= 67) return 'bg-green-400';
                          if (p >= 34) return 'bg-yellow-500';
                          return 'bg-red-500';
                        };
                        return (
                          <>
                            <div className="w-20 h-2 bg-[var(--color-bg)] rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-300 ${getColor(percent)}`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium whitespace-nowrap">
                              {percent}%
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
                  )}
                </div>
                <div className="text-sm text-[var(--color-text-muted)]">
                  {criteriaCount} criter{criteriaCount === 1 ? 'ion' : 'ia'}
                  {isSubmitted && <span className="ml-2 text-green-500">· Submitted</span>}
                </div>
                {isLocked && (
                  <div className="mt-2 text-xs text-[var(--color-text-muted)]">
                    Locked by Admin
                  </div>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="bg-[var(--color-bg-subtle)] rounded-xl shadow-sm border border-[var(--color-border)] p-8 text-center">
          <p className="text-[var(--color-text-muted)] text-lg">
            No scoring categories available yet.
          </p>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">
            The admin hasn't configured categories for this event.
          </p>
        </div>
      )}
    </div>
  );
}
