import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, ChevronRight, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { getJudgeSession, clearJudgeSession } from '../utils/session';
import { scoringAPI, submissionsAPI } from '../api';
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

  useEffect(() => {
    const s = getJudgeSession();
    if (!s) {
      navigate('/judge/login');
      return;
    }
    setSession(s);
    loadScoringContext(s.judgeId, s.eventId);
  }, [navigate]);

  // Listen for admin unlock notifications
  useEffect(() => {
    const unsub = onEvent('sheet_unlocked', (data) => {
      setSubmittedCategories((prev) => {
        const next = new Set(prev);
        next.delete(data.categoryId);
        return next;
      });
      setUnlockedCategory(data.categoryId);
      // If currently viewing this category, re-select to refresh
      if (selectedCategory?.id === data.categoryId) {
        setSelectedCategory((prev) => prev ? { ...prev, _unlocked: true } : null);
      }
      // Auto-clear notification after 5s
      setTimeout(() => setUnlockedCategory(null), 5000);
    });
    return unsub;
  }, [onEvent, selectedCategory]);

  const loadScoringContext = async (judgeId, eventId) => {
    try {
      const res = await scoringAPI.getContext(judgeId, eventId);
      setScoringData(res.data);
    } catch (err) {
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

      // 10.2.6: Track score count for this category
      setCategoryScoreCounts((prev) => ({
        ...prev,
        [cat.id]: { scored: (res.data.scores || []).length, total: cat.criteria?.length || 0 },
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

  const handleSubmitCategory = async () => {
    if (!session || !selectedCategory) return;

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
            onBack={handleBackToCategories}
            onSubmit={handleSubmitCategory}
            onContestantsChange={handleContestantsChange}
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
            const isLocked = cat.is_locked;
            const isSubmitted = submittedCategories.has(cat.id);
            const scored = categoryScoreCounts[cat.id]?.scored || 0;

            return (
              <button
                key={cat.id}
                onClick={() => handleSelectCategory(cat)}
                disabled={isLocked}
                aria-label={`${cat.name}: ${isSubmitted ? 'Submitted' : isLocked ? 'Locked' : scored > 0 ? `Draft ${scored}/${criteriaCount}` : 'Not started'}`}
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
                  ) : scored > 0 ? (
                    <span className="text-[var(--color-cta)] text-xs font-medium">Draft ({scored}/{criteriaCount})</span>
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
