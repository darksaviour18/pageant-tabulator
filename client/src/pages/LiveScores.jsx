import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { eventsAPI, categoriesAPI, eliminationRoundsAPI, scoresAPI } from '../api';
import { useSocket } from '../context/SocketContext';
import { Eye, Wifi, WifiOff } from 'lucide-react';

export default function LiveScores() {
  const { onEvent, connected, lastSync } = useSocket();
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState('');
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [judges, setJudges] = useState([]);
  const [contestants, setContestants] = useState([]);
  const [criteria, setCriteria] = useState([]);
  const [scoringMode, setScoringMode] = useState('direct');
  const [scores, setScores] = useState({});
  const [loading, setLoading] = useState(true);
  const [round, setRound] = useState(null);
  const [highlightedCells, setHighlightedCells] = useState(new Set());
  const abortRef = useRef(false);

  useEffect(() => {
    abortRef.current = false;
    eventsAPI.getAll().then(res => {
      const all = res.data || [];
      setEvents(all);
      const active = all.find(e => e.status === 'active');
      if (active) {
        setEventId(String(active.id));
        loadCategories(active.id);
        loadJudges(active.id);
      }
    }).catch(() => {}).finally(() => setLoading(false));
    return () => { abortRef.current = true; };
  }, []);

  const loadCategories = async (id) => {
    try {
      const [catsRes, roundsRes] = await Promise.all([
        categoriesAPI.getAll(parseInt(id, 10)),
        eliminationRoundsAPI.getAll(parseInt(id, 10)),
      ]);
      setCategories(catsRes.data || []);
      const rounds = roundsRes.data || [];
      if (selectedCategoryId) {
        const cat = (catsRes.data || []).find(c => c.id === parseInt(selectedCategoryId));
        if (cat?.required_round_id) {
          setRound(rounds.find(r => r.id === cat.required_round_id) || null);
        } else {
          setRound(null);
        }
      }
    } catch (err) {
      console.error('[LiveScores] Failed to load categories:', err);
    }
  };

  const loadJudges = async (id) => {
    try {
      const { judgesAPI } = await import('../api');
      const judgesRes = await judgesAPI.getAll(parseInt(id, 10));
      setJudges(judgesRes.data || []);
    } catch (err) {
      console.error('[LiveScores] Failed to load judges:', err);
    }
  };

  const handleEventChange = async (e) => {
    const id = e.target.value;
    setEventId(id);
    setSelectedCategoryId('');
    setScores({});
    setRound(null);
    setCriteria([]);
    setContestants([]);
    if (id) {
      setLoading(true);
      await Promise.all([loadCategories(id), loadJudges(id)]);
      setLoading(false);
    }
  };

  const handleCategoryChange = async (e) => {
    const catId = e.target.value;
    setSelectedCategoryId(catId);
    setScores({});
    setRound(null);
    if (!catId) { setCriteria([]); setContestants([]); return; }

    setLoading(true);
    try {
      const cat = categories.find(c => c.id === parseInt(catId));
      setCriteria(cat?.criteria || []);

      if (eventId) {
        const evRes = await eventsAPI.getById(parseInt(eventId, 10));
        setScoringMode(evRes.data?.scoring_mode || 'direct');
      }

      if (cat?.required_round_id) {
        const roundsRes = await eliminationRoundsAPI.getAll(parseInt(eventId, 10));
        setRound((roundsRes.data || []).find(rr => rr.id === cat.required_round_id) || null);
      }

      const scoresRes = await scoresAPI.getAllByEventAndCategory(parseInt(eventId, 10), parseInt(catId, 10));
      const rawScores = scoresRes.data || [];

      const matrix = {};
      for (const s of rawScores) {
        if (!matrix[s.judge_id]) matrix[s.judge_id] = {};
        if (!matrix[s.judge_id][s.contestant_id]) matrix[s.judge_id][s.contestant_id] = {};
        matrix[s.judge_id][s.contestant_id][s.criteria_id] = s.score;
      }
      setScores(matrix);

      if (judges.length > 0) {
        const { scoringAPI } = await import('../api');
        const ctxRes = await scoringAPI.getContext(judges[0].id, parseInt(eventId, 10));
        const allContestants = ctxRes.data?.contestants || [];

        if (cat?.required_round_id) {
          const qRes = await eliminationRoundsAPI.getQualifiers(cat.required_round_id);
          const qualifierIds = (qRes.data?.qualifiers || []).map(q => q.contestant_id);
          setContestants(allContestants.filter(c => qualifierIds.includes(c.id)));
        } else {
          setContestants(allContestants);
        }
      }
    } catch (err) {
      console.error('[LiveScores] Failed to load category data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Compute per-judge total for a contestant, normalized to 0-100
  const judgeTotal = useCallback((judgeId, contestantId) => {
    if (!scores[judgeId]?.[contestantId]) return null;
    let total = 0;
    let hasScore = false;
    for (const crit of criteria) {
      const val = scores[judgeId]?.[contestantId]?.[crit.id];
      if (val !== null && val !== undefined) {
        if (scoringMode === 'weighted') {
          total += val * crit.weight;
        } else {
          total += val;
        }
        hasScore = true;
      }
    }
    if (!hasScore) return null;
    // Normalize weighted mode to 0-100 for consistent display
    return scoringMode === 'weighted' ? Math.round(total * 10 * 10) / 10 : Math.round(total * 10) / 10;
  }, [scores, criteria, scoringMode]);

  // Client-side ranking engine — matches server _calculateRankings
  const computeRanks = useCallback((scoresMatrix, contestantsList, criteriaList, mode) => {
    const ranked = contestantsList.map(c => {
      let total = 0;
      for (const crit of criteriaList) {
        let sum = 0, count = 0;
        for (const judgeId of Object.keys(scoresMatrix)) {
          const val = scoresMatrix[judgeId]?.[c.id]?.[crit.id];
          if (val !== null && val !== undefined) { sum += val; count++; }
        }
        const avg = count > 0 ? sum / count : 0;
        total += mode === 'weighted' ? avg * crit.weight : avg;
      }
      return {
        contestant: c,
        total_score: Math.round(total * 1000) / 1000,
      };
    });

    ranked.sort((a, b) => {
      if (b.total_score !== a.total_score) return b.total_score - a.total_score;
      return a.contestant.number - b.contestant.number;
    });

    let currentRank = 1;
    for (let i = 0; i < ranked.length; i++) {
      if (i > 0 && ranked[i].total_score < ranked[i - 1].total_score) {
        currentRank = i + 1;
      }
      ranked[i].rank = currentRank;
    }
    return ranked;
  }, []);

  const rankedContestants = useMemo(
    () => computeRanks(scores, contestants, criteria, scoringMode),
    [scores, contestants, criteria, scoringMode, computeRanks]
  );

  // Compute average per contestant (average of per-judge totals)
  const contestantAvg = useCallback((contestantId) => {
    let sum = 0, count = 0;
    for (const judgeId of Object.keys(scores)) {
      const total = judgeTotal(judgeId, contestantId);
      if (total !== null) { sum += total; count++; }
    }
    return count > 0 ? Math.round((sum / count) * 10) / 10 : null;
  }, [scores, judgeTotal]);

  // WebSocket listeners
  useEffect(() => {
    if (!selectedCategoryId || !eventId) return;

    const unsubScore = onEvent('score_updated', (data) => {
      if (String(data.category_id) !== selectedCategoryId) return;

      const key = `${data.judge_id}:${data.contestant_id}`;
      setScores(prev => {
        const next = { ...prev };
        if (!next[data.judge_id]) next[data.judge_id] = {};
        if (!next[data.judge_id][data.contestant_id]) next[data.judge_id][data.contestant_id] = {};
        next[data.judge_id][data.contestant_id] = {
          ...next[data.judge_id][data.contestant_id],
          [data.criteria_id]: data.score,
        };
        return next;
      });

      setHighlightedCells(prev => new Set([...prev, key]));
      setTimeout(() => {
        setHighlightedCells(prev => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }, 500);
    });

    const unsubContestants = onEvent('contestants_updated', (data) => {
      if (String(data.categoryId) === selectedCategoryId) {
        handleCategoryChange({ target: { value: selectedCategoryId } });
      }
    });

    const unsubJudgeConnected = onEvent('judge_connected', () => {
      if (eventId) loadJudges(parseInt(eventId, 10));
    });

    return () => { unsubScore(); unsubContestants(); unsubJudgeConnected(); };
  }, [onEvent, selectedCategoryId, eventId]);

  // Re-fetch on reconnect
  useEffect(() => {
    if (lastSync && selectedCategoryId) {
      handleCategoryChange({ target: { value: selectedCategoryId } });
    }
  }, [lastSync]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--color-cta)] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Eye className="w-6 h-6 text-[var(--color-cta)]" />
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text)]">Live Scores</h2>
            <p className="text-xs text-[var(--color-text-muted)]">Consolidated judge scores updating in real-time</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {connected ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">
              <Wifi className="w-3 h-3" /> Live
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
              <WifiOff className="w-3 h-3" /> Offline
            </span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Event</label>
          <select value={eventId} onChange={handleEventChange}
            className="px-3 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-cta)] outline-none bg-[var(--color-bg-subtle)] text-[var(--color-text)] min-w-[200px] text-sm">
            <option value="">Select event...</option>
            {events.map(e => (
              <option key={e.id} value={e.id}>{e.name} ({e.status})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Category</label>
          <select value={selectedCategoryId} onChange={handleCategoryChange}
            className="px-3 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-cta)] outline-none bg-[var(--color-bg-subtle)] text-[var(--color-text)] min-w-[200px] text-sm">
            <option value="">Select category...</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.required_round_id ? ' 🏆' : ''}</option>
            ))}
          </select>
        </div>
        {round && (
          <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
            🏆 {round.round_name} — only {round.contestant_count} qualifiers
          </div>
        )}
      </div>

      {/* Score Table */}
      {!selectedCategoryId ? (
        <div className="text-center py-12 text-[var(--color-text-muted)]">
          <p className="text-lg">Select a category to view live scores.</p>
        </div>
      ) : criteria.length === 0 ? (
        <div className="text-center py-12 text-[var(--color-text-muted)]">
          <p className="text-lg">No criteria configured for this category.</p>
        </div>
      ) : rankedContestants.length === 0 ? (
        <div className="text-center py-12 text-[var(--color-text-muted)]">
          <p className="text-lg">No scores have been submitted yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-sm">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[var(--color-bg)] border-b border-[var(--color-border)]">
                <th className="sticky left-0 z-10 bg-[var(--color-bg)] text-center py-2 px-2 text-xs font-semibold text-[var(--color-text-muted)] w-12">Rank</th>
                <th className="sticky left-0 z-10 bg-[var(--color-bg)] text-left py-2 px-3 text-xs font-semibold text-[var(--color-text-muted)] min-w-[140px]" style={{ left: '48px' }}>Contestant</th>
                {judges.map(j => (
                  <th key={j.id} className="text-center py-2 px-3 text-xs font-semibold text-[var(--color-text-muted)] border-l border-[var(--color-border)] min-w-[80px]">
                    {j.name}<br /><span className="opacity-60">Total</span>
                  </th>
                ))}
                <th className="text-center py-2 px-3 text-xs font-semibold text-[var(--color-text-muted)] border-l border-[var(--color-border)] min-w-[80px]">
                  Avg<br /><span className="opacity-60">0–100</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rankedContestants.map((rc, idx) => {
                const c = rc.contestant;
                const avg = contestantAvg(c.id);
                const isQualifier = round && rc.rank <= round.contestant_count;
                // Cut line: after the last qualifier whose next contestant has a different rank
                const drawCutLine = round && isQualifier && idx < rankedContestants.length - 1 &&
                  rankedContestants[idx + 1].rank > round.contestant_count;

                return (
                  <tr key={c.id} className={`border-b border-[var(--color-border)] hover:bg-[var(--color-bg)] transition-colors ${
                    isQualifier ? 'bg-green-500/[0.04]' : ''
                  }`}>
                    <td className={`sticky left-0 z-10 bg-[var(--color-bg-elevated)] text-center py-2 px-2 text-sm font-bold ${
                      isQualifier ? 'text-emerald-700' : 'text-[var(--color-text)]'
                    }`}>
                      {rc.rank}
                    </td>
                    <td className="sticky left-0 z-10 bg-[var(--color-bg-elevated)] text-left py-2 px-3 text-sm font-medium text-[var(--color-text)] whitespace-nowrap" style={{ left: '48px' }}>
                      #{c.number} {c.name}
                    </td>
                    {judges.map(j => {
                      const total = judgeTotal(j.id, c.id);
                      const cellKey = `${j.id}:${c.id}`;
                      const isHighlighted = highlightedCells.has(cellKey);
                      return (
                        <td key={cellKey} className={`text-center py-2 px-3 text-sm font-mono border-l border-[var(--color-border)] transition-all duration-300 ${
                          isHighlighted ? 'bg-emerald-200/60' : ''
                        }`}>
                          {total !== null ? Math.round(total) : '—'}
                        </td>
                      );
                    })}
                    <td className="text-center py-2 px-3 text-sm font-bold font-mono text-[var(--color-text)] border-l border-[var(--color-border)]">
                      {avg !== null ? Math.round(avg) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {/* Cut line indicator */}
          {round && rankedContestants.some((rc, idx) => {
            const isQualifier = rc.rank <= round.contestant_count;
            const nextIsOut = idx < rankedContestants.length - 1 &&
              rankedContestants[idx + 1].rank > round.contestant_count;
            return isQualifier && nextIsOut;
          }) && (
            <div className="border-t-2 border-dashed border-amber-400 mx-2 mb-2" />
          )}
        </div>
      )}
    </div>
  );
}
