import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Calendar, ChevronRight, AlertCircle } from 'lucide-react';
import { getJudgeSession, clearJudgeSession } from '../utils/session';
import { scoringAPI, submissionsAPI } from '../api';
import ScoreSheet from '../components/ScoreSheet';
import { useSocket } from '../context/SocketContext';

export default function JudgeDashboard() {
  const navigate = useNavigate();
  const { onEvent } = useSocket();
  const [session, setSession] = useState(null);
  const [scoringData, setScoringData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [submittedCategories, setSubmittedCategories] = useState(new Set());
  const [unlockedCategory, setUnlockedCategory] = useState(null);
  const [categoryScores, setCategoryScores] = useState([]);
  const [loadingScores, setLoadingScores] = useState(false);

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
    } catch (err) {
      console.error('Failed to load category scores:', err);
      setCategoryScores([]);
    } finally {
      setLoadingScores(false);
    }
  };

  const handleBackToCategories = () => {
    setSelectedCategory(null);
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
        <div className="text-slate-500 text-lg">Loading...</div>
      </div>
    );
  }

  // Show spreadsheet if a category is selected
  if (selectedCategory && scoringData) {
    return (
      <div className="space-y-6">
        {/* Compact header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              {session.judgeName} — {session.eventName}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Scoring: {selectedCategory.name}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>

        {loadingScores ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-slate-500 text-lg">Loading scores...</div>
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
          />
        )}
      </div>
    );
  }

  // Category selection view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome, {session.judgeName}
          </h1>
          <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
            <Calendar className="w-4 h-4" />
            <span>{session.eventName}</span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Unlock Notification Banner */}
      {unlockedCategory && scoringData && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg flex items-center gap-2 animate-pulse">
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {scoringData.categories.map((cat) => {
            const criteriaCount = cat.criteria?.length || 0;
            const isLocked = cat.is_locked;
            const isSubmitted = submittedCategories.has(cat.id);

            return (
              <button
                key={cat.id}
                onClick={() => !isLocked && !isSubmitted && handleSelectCategory(cat)}
                disabled={isLocked || isSubmitted}
                className={`text-left p-5 rounded-xl border-2 transition-all ${
                  isSubmitted
                    ? 'border-green-200 bg-green-50 cursor-not-allowed'
                    : isLocked
                    ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-60'
                    : 'border-slate-200 hover:border-amber-400 hover:shadow-md bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-slate-900">{cat.name}</h3>
                  {isSubmitted ? (
                    <span className="text-green-600 text-xs font-medium">✓ Submitted</span>
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                <div className="text-sm text-slate-500">
                  {criteriaCount} criter{criteriaCount === 1 ? 'ion' : 'ia'}
                </div>
                {isLocked && (
                  <div className="mt-2 text-xs text-slate-400">
                    Locked by Admin
                  </div>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          <p className="text-slate-400 text-lg">
            No scoring categories available yet.
          </p>
          <p className="text-slate-400 text-sm mt-1">
            The admin hasn't configured categories for this event.
          </p>
        </div>
      )}
    </div>
  );
}
