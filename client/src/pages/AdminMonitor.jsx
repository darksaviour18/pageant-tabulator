import { useState, useEffect, useMemo, useCallback } from 'react';
import { eventsAPI, judgesAPI, categoriesAPI } from '../api';
import { submissionsAPI } from '../api';
import { useSocket } from '../context/SocketContext';
import {
  Eye,
  Lock,
  Unlock,
  AlertCircle,
} from 'lucide-react';

export default function AdminMonitor() {
  const { connected, lastSync, onEvent } = useSocket();
  const [event, setEvent] = useState(null);
  const [judges, setJudges] = useState([]);
  const [categories, setCategories] = useState([]);
  const [progress, setProgress] = useState({}); // { "judgeId:categoryId": { scored, total, submitted } }
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(null); // "judgeId:categoryId" while unlocking
  const [unlockMsg, setUnlockMsg] = useState(null);
  const [lockStatus, setLockStatus] = useState({}); // { categoryId: isLocked }

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      // Get active event
      const eventsRes = await eventsAPI.getAll();
      const activeEvent = eventsRes.data.find((e) => e.status === 'active');
      if (!activeEvent) {
        setLoading(false);
        return;
      }
      setEvent(activeEvent);

      // Get judges
      const judgesRes = await judgesAPI.getAll(activeEvent.id);
      setJudges(judgesRes.data);

      // Get categories with criteria
      const categoriesRes = await categoriesAPI.getAll(activeEvent.id);
      setCategories(categoriesRes.data);

      // 10.2.8: Fetch existing scores to populate progress bars
      const initialProgress = {};
      const initialLockStatus = {};
      for (const judge of judgesRes.data) {
        for (const cat of categoriesRes.data) {
          const criteriaCount = cat.criteria?.length || 0;

          // Fetch existing scores for this judge+category
          let scoredCount = 0;
          try {
            const scoresRes = await fetch(`/api/scoring/${judge.id}/event/${activeEvent.id}/category/${cat.id}`);
            if (scoresRes.ok) {
              const data = await scoresRes.json();
              scoredCount = data.scores?.length || 0;
            }
          } catch {
            // Ignore fetch errors, default to 0
          }

          initialProgress[`${judge.id}:${cat.id}`] = {
            scored: scoredCount,
            total: criteriaCount,
            submitted: false,
          };
        }
      }
      setProgress(initialProgress);
      setLockStatus(initialLockStatus);
    } catch (err) {
      console.error('Failed to load monitor data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Listen to real-time socket events
  useEffect(() => {
    const unsubProgress = onEvent('judge_progress', (data) => {
      setProgress((prev) => ({
        ...prev,
        [`${data.judgeId}:${data.categoryId}`]: {
          scored: data.scored,
          total: data.total,
          submitted: data.submitted,
        },
      }));
    });

    const unsubSubmitted = onEvent('category_submitted', (data) => {
      setProgress((prev) => ({
        ...prev,
        [`${data.judgeId}:${data.categoryId}`]: {
          ...(prev[`${data.judgeId}:${data.categoryId}`] || {}),
          submitted: true,
        },
      }));
    });

    return () => {
      unsubProgress();
      unsubSubmitted();
    };
  }, [onEvent]);

  const handleUnlock = useCallback(async (judgeId, judgeName, categoryId, categoryName) => {
    const key = `${judgeId}:${categoryId}`;
    if (!confirm(`Unlock "${categoryName}" for ${judgeName}? They will be able to edit scores again.`)) return;

    setUnlocking(key);
    try {
      await submissionsAPI.unlockCategory(judgeId, categoryId);
      setProgress((prev) => ({
        ...prev,
        [key]: { ...(prev[key] || {}), submitted: false },
      }));
      setUnlockMsg(`Unlocked "${categoryName}" for ${judgeName}`);
      setTimeout(() => setUnlockMsg(null), 4000);
    } catch (err) {
      setUnlockMsg(err.response?.data?.error || 'Failed to unlock');
      setTimeout(() => setUnlockMsg(null), 4000);
    } finally {
      setUnlocking(null);
    }
  }, []);

  // 10.2.7: Toggle category-level lock/unlock
  const handleToggleCategoryLock = useCallback(async (cat) => {
    const newLocked = !lockStatus[cat.id];
    const action = newLocked ? 'Lock' : 'Unlock';
    if (!confirm(`${action} "${cat.name}" for ALL judges?`)) return;

    try {
      const res = await categoriesAPI.update(cat.id, { is_locked: newLocked });
      setLockStatus((prev) => ({ ...prev, [cat.id]: res.data.is_locked }));
      setUnlockMsg(`${cat.name} ${newLocked ? 'locked' : 'unlocked'} for all judges`);
      setTimeout(() => setUnlockMsg(null), 4000);
    } catch (err) {
      setUnlockMsg(err.response?.data?.error || `Failed to ${action.toLowerCase()} ${cat.name}`);
      setTimeout(() => setUnlockMsg(null), 4000);
    }
  }, [lockStatus]);

  const timeSinceSync = useMemo(() => {
    if (!lastSync) return null;
    const diff = Math.floor((Date.now() - lastSync) / 1000);
    if (diff < 5) return 'just now';
    if (diff < 60) return `${diff}s ago`;
    return `${Math.floor(diff / 60)}m ago`;
  }, [lastSync]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-slate-500 text-lg">Loading monitor...</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-700">No Active Event</h2>
        <p className="text-slate-500 mt-2">Create an event in the Setup tab to start monitoring.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-slate-600">
            {connected ? `Connected · Last sync: ${timeSinceSync || '...'}` : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Category Lock Toggles — 10.2.7 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Category Controls</h3>
        <div className="flex flex-wrap gap-3">
          {categories.map((cat) => {
            const isLocked = lockStatus[cat.id] || cat.is_locked;
            return (
              <button
                key={cat.id}
                onClick={() => handleToggleCategoryLock(cat)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isLocked
                    ? 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-200'
                    : 'bg-green-100 text-green-700 hover:bg-green-200 border border-green-200'
                }`}
              >
                {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                {cat.name} {isLocked ? '(Locked)' : '(Open)'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Judge Progress Cards */}
      {judges.length > 0 && categories.length > 0 ? (
        <>
          {/* Unlock Feedback Message */}
          {unlockMsg && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <Unlock className="w-4 h-4" />
              {unlockMsg}
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {judges.map((judge) => (
            <div
              key={judge.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
            >
              {/* Judge Header */}
              <div className="bg-slate-50 px-5 py-3 border-b border-slate-200">
                <h3 className="font-semibold text-slate-900">
                  {judge.name}{' '}
                  <span className="text-sm font-normal text-slate-500">(Seat #{judge.seat_number})</span>
                </h3>
              </div>

              {/* Category Progress */}
              <div className="p-4 space-y-4">
                {categories.map((cat) => {
                  const key = `${judge.id}:${cat.id}`;
                  const p = progress[key] || { scored: 0, total: 0, submitted: false };
                  const pct = p.total > 0 ? Math.round((p.scored / p.total) * 100) : 0;
                  const isComplete = p.scored >= p.total && p.total > 0;

                  return (
                    <div key={cat.id}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-slate-700">{cat.name}</span>
                        <div className="flex items-center gap-1.5">
                          <StatusBadge submitted={p.submitted} complete={isComplete} pct={pct} />
                          {p.submitted && (
                            <button
                              onClick={() => handleUnlock(judge.id, judge.name, cat.id, cat.name)}
                              disabled={unlocking === key}
                              className="p-1 text-slate-400 hover:text-amber-600 transition-colors disabled:opacity-50"
                              title="Unlock sheet for re-editing"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            p.submitted
                              ? 'bg-green-500'
                              : cat.is_locked
                              ? 'bg-slate-400'
                              : pct > 0
                              ? 'bg-amber-500'
                              : 'bg-slate-200'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {p.scored}/{p.total} scored
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        </>
      ) : (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <p className="text-slate-400">
            {judges.length === 0 ? 'No judges added yet.' : 'No categories configured.'}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Status badge: Submitted (green), Complete but not submitted (amber), Draft (yellow), Not started (gray), Locked (slate).
 */
function StatusBadge({ submitted, complete, pct }) {
  if (submitted) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <Lock className="w-3 h-3" /> Submitted
      </span>
    );
  }
  if (complete) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
        Ready to submit
      </span>
    );
  }
  if (pct > 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
        Draft
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
      Not started
    </span>
  );
}
