import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { eventsAPI, judgesAPI, categoriesAPI } from '../api';
import { submissionsAPI } from '../api';
import { useSocket } from '../context/SocketContext';
import ConfirmDialog from '../components/ConfirmDialog';
import SyncStatus from '../components/SyncStatus';
import {
  Eye,
  Lock,
  Unlock,
  AlertCircle,
  X,
} from 'lucide-react';

export default function AdminMonitor() {
  const { connected, lastSync, onEvent } = useSocket();
  const [event, setEvent] = useState(null);
  const [judges, setJudges] = useState([]);
  const [categories, setCategories] = useState([]);
  const [progress, setProgress] = useState({}); // { "judgeId:categoryId": { scored, total, submitted } }
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(null);
  const [unlockMsg, setUnlockMsg] = useState(null);
  const [lockStatus, setLockStatus] = useState({});
  const [confirmDialog, setConfirmDialog] = useState(null); // { categoryId: isLocked }

  // 11.6.1: Live score preview state
  const [previewJudge, setPreviewJudge] = useState(null); // { judge, category, scores }
  const [previewLoading, setPreviewLoading] = useState(false);

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

      // 10.2.8 + 11.3.1: Fetch existing scores with AbortController + timeout
      const initialProgress = {};
      const initialLockStatus = {};
      const fetchPromises = [];

      for (const judge of judgesRes.data) {
        for (const cat of categoriesRes.data) {
          const criteriaCount = cat.criteria?.length || 0;
          const key = `${judge.id}:${cat.id}`;

          initialProgress[key] = { scored: 0, total: criteriaCount, submitted: false };

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);

          fetchPromises.push(
            axios
              .get(`/api/scoring/${judge.id}/event/${activeEvent.id}/category/${cat.id}`, {
                signal: controller.signal,
              })
              .then((res) => {
                initialProgress[key].scored = res.data.scores?.length || 0;
              })
              .catch(() => {
                // Timeout or error — keep scored at 0
              })
              .finally(() => clearTimeout(timeout))
          );
        }
      }

      // Wait for all score fetches (with individual timeouts)
      await Promise.allSettled(fetchPromises);

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
    setConfirmDialog({
      title: 'Unlock Category',
      message: `Unlock "${categoryName}" for ${judgeName}? They will be able to edit scores again.`,
      confirmLabel: 'Unlock',
      variant: 'default',
      onConfirm: async () => {
        setConfirmDialog(null);
        const key = `${judgeId}:${categoryId}`;
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
      },
      onCancel: () => setConfirmDialog(null),
    });
  }, []);

  // 10.2.7: Toggle category-level lock/unlock
  const handleToggleCategoryLock = useCallback(async (cat) => {
    const newLocked = !lockStatus[cat.id];
    const action = newLocked ? 'Lock' : 'Unlock';
    setConfirmDialog({
      title: `${action} Category`,
      message: `${action} "${cat.name}" for ALL judges?`,
      confirmLabel: action,
      variant: newLocked ? 'danger' : 'default',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const res = await categoriesAPI.update(cat.id, { is_locked: newLocked });
          setLockStatus((prev) => ({ ...prev, [cat.id]: res.data.is_locked }));
          setUnlockMsg(`${cat.name} ${newLocked ? 'locked' : 'unlocked'} for all judges`);
          setTimeout(() => setUnlockMsg(null), 4000);
        } catch (err) {
          setUnlockMsg(err.response?.data?.error || `Failed to ${action.toLowerCase()} ${cat.name}`);
          setTimeout(() => setUnlockMsg(null), 4000);
        }
      },
      onCancel: () => setConfirmDialog(null),
    });
  }, [lockStatus]);

  // 11.6.1: Fetch judge's scores for a category and show preview
  const handleViewJudgeScores = useCallback(async (judge, cat) => {
    setPreviewJudge({ judge, category: cat, scores: [], loading: true });
    setPreviewLoading(true);
    try {
      const res = await axios.get(`/api/scoring/${judge.id}/event/${event.id}/category/${cat.id}`);
      setPreviewJudge((prev) => ({
        ...prev,
        scores: res.data.scores || [],
        submitted: res.data.submitted || false,
        unlockedByAdmin: res.data.unlockedByAdmin || false,
      }));
    } catch (err) {
      console.error('Failed to load judge scores:', err);
      setPreviewJudge((prev) => ({ ...prev, scores: [] }));
    } finally {
      setPreviewLoading(false);
    }
  }, [event]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-[var(--color-text-muted)] text-lg">Loading monitor...</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-[var(--color-text)]">No Active Event</h2>
        <p className="text-[var(--color-text-muted)] mt-2">Create an event in the Setup tab to start monitoring.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <SyncStatus connected={connected} lastSync={lastSync} />
      </div>

      {/* Category Lock Toggles — 10.2.7 */}
      <div className="bg-[var(--color-bg-subtle)] rounded-xl shadow-sm border border-[var(--color-border)] p-4">
        <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Category Controls</h3>
        <div className="flex flex-wrap gap-3">
          {categories.map((cat) => {
            const isLocked = lockStatus[cat.id] || cat.is_locked;
            return (
              <button
                key={cat.id}
                onClick={() => handleToggleCategoryLock(cat)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isLocked
                    ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20'
                    : 'bg-green-500/10 text-green-500 hover:bg-green-500/20 border border-green-500/20'
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
            <div className="bg-green-500/10 border border-green-500/20 text-green-500 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <Unlock className="w-4 h-4" />
              {unlockMsg}
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {judges.map((judge) => (
            <div
              key={judge.id}
              className="bg-[var(--color-bg-subtle)] rounded-xl shadow-sm border border-[var(--color-border)] overflow-hidden"
            >
              {/* Judge Header */}
              <div className="bg-[var(--color-bg)] px-5 py-3 border-b border-[var(--color-border)]">
                <h3 className="font-semibold text-[var(--color-text)]">
                  {judge.name}{' '}
                  <span className="text-sm font-normal text-[var(--color-text-muted)]">(Seat #{judge.seat_number})</span>
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
                        <span className="text-sm font-medium text-[var(--color-text)]">{cat.name}</span>
                        <div className="flex items-center gap-1.5">
                          <StatusBadge submitted={p.submitted} complete={isComplete} pct={pct} />
                          {/* 11.6.1: View judge scores button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewJudgeScores(judge, cat);
                            }}
                            className="p-1 text-[var(--color-text-muted)] hover:text-blue-500 transition-colors"
                            title="View judge's draft scores"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {p.submitted && (
                            <button
                              onClick={() => handleUnlock(judge.id, judge.name, cat.id, cat.name)}
                              disabled={unlocking === key}
                              className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-cta)] transition-colors disabled:opacity-50"
                              title="Unlock sheet for re-editing"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="w-full bg-[var(--color-border)] rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            p.submitted
                              ? 'bg-green-500'
                              : cat.is_locked
                              ? 'bg-[var(--color-text-muted)]'
                              : pct > 0
                              ? 'bg-[var(--color-cta)]'
                              : 'bg-[var(--color-border)]'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)] mt-1">
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
        <div className="text-center py-16 bg-[var(--color-bg-subtle)] rounded-xl border border-[var(--color-border)]">
          <AlertCircle className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-4 opacity-50" />
          <p className="text-[var(--color-text-secondary)]">
            {judges.length === 0 ? 'No judges added yet.' : 'No categories configured.'}
          </p>
          <p className="text-sm text-[var(--color-text-muted)] mt-2">
            Go to the <strong>Setup</strong> tab to add {judges.length === 0 ? 'judges' : 'categories'}.
          </p>
        </div>
      )}

      {/* 11.6.1: Score Preview Modal */}
      {previewJudge && (
        <ScorePreviewModal
          preview={previewJudge}
          onClose={() => setPreviewJudge(null)}
        />
      )}

      <ConfirmDialog {...confirmDialog} />
    </div>
  );
}

/**
 * 11.6.1: Score preview modal — shows a judge's draft scores for a category.
 */
function ScorePreviewModal({ preview, onClose }) {
  if (!preview) return null;

  const { judge, category, scores, submitted, unlockedByAdmin } = preview;

  // Build a matrix: rows = criteria, columns = contestants with scores
  const criteriaMap = {};
  const contestantScores = {};
  for (const s of scores) {
    if (!contestantScores[s.contestant_id]) contestantScores[s.contestant_id] = {};
    contestantScores[s.contestant_id][s.criteria_id] = s.score;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl bg-[var(--color-bg-subtle)] rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between bg-[var(--color-bg)] px-6 py-4 border-b border-[var(--color-border)]">
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-text)]">
              {judge.name} — {category.name}
            </h3>
            <p className="text-sm text-[var(--color-text-muted)]">
              {submitted ? (
                <span className="text-green-500">✓ Submitted</span>
              ) : (
                <span className="text-[var(--color-cta)]">Draft — {scores.length} scores entered</span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scores Table */}
        <div className="p-6">
          {scores.length === 0 ? (
            <p className="text-center text-[var(--color-text-muted)] py-8">No scores entered yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="text-left py-2 px-3 text-[var(--color-text-muted)] font-medium">Contestant</th>
                    {Object.keys(contestantScores).map((cid) => {
                      const c = category.contestants?.find((ct) => ct.id === parseInt(cid));
                      return (
                        <th key={cid} className="text-center py-2 px-3 text-[var(--color-text-muted)] font-medium">
                          {c ? `#${c.number}` : `#${cid}`}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {category.criteria?.map((crit) => (
                    <tr key={crit.id} className="border-b border-[var(--color-border)]">
                      <td className="py-2 px-3 text-[var(--color-text)] font-medium">{crit.name}</td>
                      {Object.keys(contestantScores).map((cid) => (
                        <td key={`${cid}-${crit.id}`} className="py-2 px-3 text-center">
                          {contestantScores[cid]?.[crit.id] !== undefined ? (
                            <span className="font-mono text-[var(--color-text)]">
                              {contestantScores[cid][crit.id]}
                            </span>
                          ) : (
                            <span className="text-[var(--color-text-muted)]">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Status badge: Submitted (green), Complete but not submitted (amber), Draft (yellow), Not started (gray), Locked (slate).
 */
function StatusBadge({ submitted, complete, pct }) {
  if (submitted) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500">
        <Lock className="w-3 h-3" /> Submitted
      </span>
    );
  }
  if (complete) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500">
        Ready to submit
      </span>
    );
  }
  if (pct > 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500">
        Draft
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]">
      Not started
    </span>
  );
}
