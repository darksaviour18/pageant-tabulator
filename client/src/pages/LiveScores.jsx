import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { eventsAPI, categoriesAPI, eliminationRoundsAPI, scoresAPI } from '../api';
import { useSocket } from '../context/SocketContext';
import { Eye, Wifi, WifiOff } from 'lucide-react';

export default function LiveScores() {
  const { onEvent, connected, lastSync } = useSocket();
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState('');
  const [rounds, setRounds] = useState([]);
  const [categories, setCategories] = useState([]);
  const [judges, setJudges] = useState([]);
  const [selectedRoundId, setSelectedRoundId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [contestants, setContestants] = useState([]);
  const [criteria, setCriteria] = useState([]);
  const [scoringMode, setScoringMode] = useState('direct');
  const [qualifyingCatIds, setQualifyingCatIds] = useState([]);
  const [catData, setCatData] = useState({});
  const [scores, setScores] = useState({});
  const [round, setRound] = useState(null);
  const [loading, setLoading] = useState(true);
  const [highlightedCells, setHighlightedCells] = useState(new Set());
  const catDataRef = useRef(catData);
  const catFlushTimer = useRef(null);
  const scoresRef = useRef(scores);
  const scoresFlushTimer = useRef(null);
  const handleRoundChangeRef = useRef(null);
  const fetchAbortRef = useRef(null);

  useEffect(() => {
    eventsAPI.getAll().then(res => {
      const all = res.data || [];
      setEvents(all);
      const active = all.find(e => e.status === 'active');
      if (active) {
        setEventId(String(active.id));
        loadRounds(active.id);
        loadJudges(active.id);
      }
    }).catch(() => {}).finally(() => setLoading(false));
    return () => { clearTimeout(catFlushTimer.current); clearTimeout(scoresFlushTimer.current); };
  }, []);

  const loadRounds = async (id) => {
    try {
      const [roundsRes, catsRes] = await Promise.all([
        eliminationRoundsAPI.getAll(parseInt(id, 10)),
        categoriesAPI.getAll(parseInt(id, 10)),
      ]);
      setRounds(roundsRes.data || []);
      setCategories(catsRes.data || []);
    } catch (err) {
      console.error('[LiveScores] Failed to load rounds:', err);
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
    setSelectedRoundId('');
    setSelectedCategoryId('');
    setCatData({});
    setScores({});
    setRound(null);
    setContestants([]);
    setCriteria([]);
    setQualifyingCatIds([]);
    if (id) {
      setLoading(true);
      await Promise.all([loadRounds(id), loadJudges(id)]);
      setLoading(false);
    }
  };

  // Parse value prefix and dispatch to the appropriate handler
  const handleSelect = async (e) => {
    const val = e.target.value;
    if (!val) {
      fetchAbortRef.current?.abort();
      setSelectedRoundId('');
      setSelectedCategoryId('');
      setCatData({});
      setScores({});
      setContestants([]);
      setCriteria([]);
      setRound(null);
      setQualifyingCatIds([]);
      return;
    }
    const dash = val.indexOf('-');
    const type = val.substring(0, dash);
    const id = val.substring(dash + 1);

    try {
      if (type === 'round') {
        setSelectedCategoryId('');
        await handleRoundChange(id);
      } else if (type === 'cat') {
        setSelectedRoundId('');
        setRound(null);
        setQualifyingCatIds([]);
        await handleCategoryChange(id);
      }
    } catch (err) {
      console.error('[LiveScores] Selection error:', err);
    }
  };

  // Determine the selected value for the dropdown
  const selectedValue = selectedRoundId ? `round-${selectedRoundId}` : selectedCategoryId ? `cat-${selectedCategoryId}` : '';

  // === Round-backed cross-category view ===
  const handleRoundChange = useCallback(async (rId) => {
    setSelectedRoundId(rId);
    // Don't clear catData — keep showing the previous table until new data arrives

    if (!rId) { setRound(null); setQualifyingCatIds([]); setCatData({}); return; }

    if (fetchAbortRef.current) fetchAbortRef.current.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    try {
      const r = rounds.find(rr => rr.id === parseInt(rId));
      if (!r) { setLoading(false); return; }
      setRound(r);

      let qIds;
      if (Array.isArray(r.qualifying_category_ids)) qIds = r.qualifying_category_ids;
      else if (typeof r.qualifying_category_ids === 'string') qIds = JSON.parse(r.qualifying_category_ids);
      else qIds = [];
      setQualifyingCatIds(qIds);
      if (!qIds.length) { setLoading(false); return; }

      const scorePromises = qIds.map(catId =>
        scoresAPI.getAllByEventAndCategory(parseInt(eventId, 10), catId)
          .then(res => ({ catId, data: res.data || [] }))
          .catch(() => ({ catId, data: [] }))
      );
      const evRes = await eventsAPI.getById(parseInt(eventId, 10));
      const mode = evRes.data?.scoring_mode || 'direct';
      setScoringMode(mode);
      const scoreResults = await Promise.all(scorePromises);
      const data = {};
      const contestantSet = new Set();
      for (const { catId, data: rawScores } of scoreResults) {
        const matrix = {};
        for (const s of rawScores) {
          if (!matrix[s.judge_id]) matrix[s.judge_id] = {};
          if (!matrix[s.judge_id][s.contestant_id]) matrix[s.judge_id][s.contestant_id] = {};
          matrix[s.judge_id][s.contestant_id][s.criteria_id] = s.score;
          contestantSet.add(s.contestant_id);
        }
        const cat = categories.find(c => c.id === catId);
        data[catId] = { scores: matrix, criteria: cat?.criteria || [], maxScore: (cat?.criteria || []).reduce((s, c) => s + c.max_score, 0), scoringMode: mode };
      }
      catDataRef.current = data;
      setCatData(data);
      const { scoringAPI } = await import('../api');
      if (judges.length > 0) {
        const ctxRes = await scoringAPI.getContext(judges[0].id, parseInt(eventId, 10));
        setContestants((ctxRes.data?.contestants || []).filter(c => contestantSet.has(c.id)));
      }
    } catch (err) {
      console.error('[LiveScores] Failed to load round data:', err);
    }
  }, [eventId, judges, rounds, categories]);

  useEffect(() => { handleRoundChangeRef.current = handleRoundChange; });

  // === Single-category view ===
  const handleCategoryChange = useCallback(async (catId) => {
    setSelectedCategoryId(catId);
    // Don't clear scores — keep showing the previous table until new data arrives

    if (!catId) { setScores({}); setCriteria([]); setContestants([]); return; }

    if (fetchAbortRef.current) fetchAbortRef.current.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    try {
      const cat = categories.find(c => c.id === parseInt(catId));
      setCriteria(cat?.criteria || []);

      if (eventId) {
        const evRes = await eventsAPI.getById(parseInt(eventId, 10));
        setScoringMode(evRes.data?.scoring_mode || 'direct');
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
      scoresRef.current = matrix;

      if (judges.length > 0) {
        const { scoringAPI } = await import('../api');
        const ctxRes = await scoringAPI.getContext(judges[0].id, parseInt(eventId, 10));
        setContestants(ctxRes.data?.contestants || []);
      }
    } catch (err) {
      console.error('[LiveScores] Failed to load category data:', err);
    }
  }, [eventId, judges, categories]);

  // Per-judge total for single-category view
  const judgeTotal = useCallback((judgeId, contestantId) => {
    if (!scores[judgeId]?.[contestantId]) return null;
    let total = 0; let hasScore = false;
    for (const crit of criteria) {
      const val = scores[judgeId]?.[contestantId]?.[crit.id];
      if (val !== null && val !== undefined) {
        total += scoringMode === 'weighted' ? val * crit.weight : val;
        hasScore = true;
      }
    }
    if (!hasScore) return null;
    return scoringMode === 'weighted' ? Math.round(total * 10) : Math.round(total * 10) / 10;
  }, [scores, criteria, scoringMode]);

  // Average across judges for single-category view
  const contestantAvg = useCallback((contestantId) => {
    let sum = 0; let count = 0;
    for (const judgeId of Object.keys(scores)) {
      const total = judgeTotal(judgeId, contestantId);
      if (total !== null) { sum += total; count++; }
    }
    return count > 0 ? Math.round((sum / count) * 10) / 10 : null;
  }, [scores, judgeTotal]);

  // Single-category ranking (matching server _calculateRankings)
  const singleCategoryRanks = useMemo(() => {
    const ranked = contestants.map(c => {
      let total = 0;
      for (const crit of criteria) {
        let sum = 0; let count = 0;
        for (const judgeId of Object.keys(scores)) {
          const val = scores[judgeId]?.[c.id]?.[crit.id];
          if (val !== null && val !== undefined) { sum += val; count++; }
        }
        const avg = count > 0 ? sum / count : 0;
        total += scoringMode === 'weighted' ? avg * crit.weight : avg;
      }
      return { contestant: c, total_score: Math.round(total * 1000) / 1000 };
    });
    ranked.sort((a, b) => {
      if (b.total_score !== a.total_score) return b.total_score - a.total_score;
      return a.contestant.number - b.contestant.number;
    });
    let currentRank = 1;
    for (let i = 0; i < ranked.length; i++) {
      if (i > 0 && ranked[i].total_score < ranked[i - 1].total_score) currentRank = i + 1;
      ranked[i].rank = currentRank;
    }
    return ranked;
  }, [contestants, criteria, scores, scoringMode]);

  // Cross-category total per contestant (average across judges per criterion)
  // Always returns a 0–100 scale regardless of how many judges submitted.
  const categoryTotal = useCallback((catId, contestantId) => {
    const d = catData[catId];
    if (!d) return null;
    let total = 0; let hasScore = false;
    for (const crit of d.criteria) {
      let sum = 0; let count = 0;
      for (const judgeId of Object.keys(d.scores)) {
        const val = d.scores[judgeId]?.[contestantId]?.[crit.id];
        if (val !== null && val !== undefined) { sum += val; count++; }
      }
      if (count === 0) continue;
      const avg = sum / count;
      total += d.scoringMode === 'weighted' ? avg * crit.weight : avg;
      hasScore = true;
    }
    return hasScore ? total : null;
  }, [catData]);

  const crossCategoryRanks = useMemo(() => {
    if (!qualifyingCatIds.length || !contestants.length) return [];
    const catWeight = 1 / qualifyingCatIds.length;
    return contestants.map(c => {
      let weightedTotal = 0;
      for (const catId of qualifyingCatIds) {
        const total = categoryTotal(catId, c.id);
        if (total !== null) weightedTotal += total * catWeight;
      }
      return { contestant: c, weighted_total: Math.round(weightedTotal * 1000) / 1000 };
    }).sort((a, b) => {
      if (b.weighted_total !== a.weighted_total) return b.weighted_total - a.weighted_total;
      return a.contestant.number - b.contestant.number;
    }).map((item, i, arr) => {
      item.rank = i > 0 && item.weighted_total < arr[i - 1].weighted_total ? i + 1 : (i > 0 ? arr[i - 1].rank : 1);
      return item;
    });
  }, [qualifyingCatIds, contestants, categoryTotal]);

  // ============== WEB SOCKET LISTENERS ==============
  useEffect(() => {
    if (!eventId) return;

    const unsubScore = onEvent('score_updated', (data) => {
      const catId = data.category_id;

      // Cross-category: patch the ref immediately, debounce state flush
      if (selectedRoundId && qualifyingCatIds.includes(catId)) {
        catDataRef.current = (() => {
          const next = { ...catDataRef.current };
          if (!next[catId]) return catDataRef.current;
          const scores = { ...next[catId].scores };
          if (!scores[data.judge_id]) scores[data.judge_id] = {};
          if (!scores[data.judge_id][data.contestant_id]) scores[data.judge_id][data.contestant_id] = {};
          scores[data.judge_id][data.contestant_id] = { ...scores[data.judge_id][data.contestant_id], [data.criteria_id]: data.score };
          next[catId] = { ...next[catId], scores };
          return next;
        })();
        clearTimeout(catFlushTimer.current);
        catFlushTimer.current = setTimeout(() => setCatData({ ...catDataRef.current }), 100);

        const key = `${catId}:c:${data.contestant_id}`;
        setHighlightedCells(prev => new Set([...prev, key]));
        setTimeout(() => setHighlightedCells(prev => { const n = new Set(prev); n.delete(key); return n; }), 500);
      }

      // Single-category: same debounced pattern
      if (selectedCategoryId && String(catId) === selectedCategoryId) {
        scoresRef.current = (() => {
          const next = { ...scoresRef.current };
          if (!next[data.judge_id]) next[data.judge_id] = {};
          if (!next[data.judge_id][data.contestant_id]) next[data.judge_id][data.contestant_id] = {};
          next[data.judge_id][data.contestant_id] = { ...next[data.judge_id][data.contestant_id], [data.criteria_id]: data.score };
          return next;
        })();
        clearTimeout(scoresFlushTimer.current);
        scoresFlushTimer.current = setTimeout(() => setScores({ ...scoresRef.current }), 100);

        const cellKey = `s:${data.judge_id}:${data.contestant_id}`;
        setHighlightedCells(prev => new Set([...prev, cellKey]));
        setTimeout(() => setHighlightedCells(prev => { const n = new Set(prev); n.delete(cellKey); return n; }), 100);
      }
    });

    const unsubJudgeConnected = onEvent('judge_connected', () => {
      if (eventId) loadJudges(parseInt(eventId, 10));
    });

    const unsubContestantsUpdated = onEvent('contestants_updated', () => {
      if (selectedRoundId) handleRoundChangeRef.current?.(selectedRoundId);
    });

    return () => { unsubScore(); unsubJudgeConnected(); unsubContestantsUpdated(); };
  }, [onEvent, eventId, selectedRoundId, selectedCategoryId, qualifyingCatIds]);

  // Re-fetch on reconnect
  useEffect(() => {
    if (!lastSync) return;
    if (selectedRoundId) handleRoundChangeRef.current?.(selectedRoundId);
    else if (selectedCategoryId) handleCategoryChange(selectedCategoryId);
  }, [lastSync]);

  if (loading) {
    return (<div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-[var(--color-cta)] border-t-transparent rounded-full" /></div>);
  }

  const isCross = !!selectedRoundId;
  const isSingle = !!selectedCategoryId;
  const emptyCategories = !categories.length;
  const emptyRounds = !rounds.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Eye className="w-6 h-6 text-[var(--color-cta)]" />
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text)]">Live Scores</h2>
            <p className="text-xs text-[var(--color-text-muted)]">Real-time scores — select a category or round</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${connected ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
          {connected ? <><Wifi className="w-3 h-3" /> Live</> : <><WifiOff className="w-3 h-3" /> Offline</>}
        </span>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Event</label>
          <select value={eventId} onChange={handleEventChange}
            className="px-3 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-cta)] outline-none bg-[var(--color-bg-subtle)] text-[var(--color-text)] min-w-[200px] text-sm">
            <option value="">Select event...</option>
            {events.map(e => <option key={e.id} value={e.id}>{e.name} ({e.status})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Category / Round</label>
          <select value={selectedValue} onChange={handleSelect}
            className="px-3 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-cta)] outline-none bg-[var(--color-bg-subtle)] text-[var(--color-text)] min-w-[280px] text-sm">
            <option value="">Select a category or round...</option>
            {!emptyCategories && (
              <optgroup label="📋 Categories">
                {categories.map(c => (
                  <option key={`cat-${c.id}`} value={`cat-${c.id}`}>{c.name}{c.required_round_id ? ' 🏆' : ''}</option>
                ))}
              </optgroup>
            )}
            {!emptyRounds && (
              <optgroup label="🏆 Rounds">
                {rounds.map(r => {
                  const qIds = Array.isArray(r.qualifying_category_ids) ? r.qualifying_category_ids
                    : (typeof r.qualifying_category_ids === 'string' ? JSON.parse(r.qualifying_category_ids) : []);
                  return (
                    <option key={`round-${r.id}`} value={`round-${r.id}`}>
                      {r.round_name} ({qIds.length} categor{qIds.length === 1 ? 'y' : 'ies'})
                    </option>
                  );
                })}
              </optgroup>
            )}
          </select>
        </div>
        {isCross && round && (
          <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
            🏆 {round.round_name} — {round.contestant_count} qualifiers — {qualifyingCatIds.length} categories
          </div>
        )}
      </div>

      {!isCross && !isSingle ? (
        <div className="text-center py-12 text-[var(--color-text-muted)]">
          <p className="text-lg">Select a category or round to view live scores.</p>
          <p className="text-sm mt-1">Categories show per-judge scores. Rounds show cross-category consolidation.</p>
        </div>
      ) : isCross && !qualifyingCatIds.length ? (
        <div className="text-center py-12 text-[var(--color-text-muted)]">
          <p className="text-lg">This round has no qualifying categories.</p>
          <p className="text-sm mt-1">Edit the round in the Rounds tab.</p>
        </div>
      ) : isCross && crossCategoryRanks.length === 0 ? (
        <div className="text-center py-12 text-[var(--color-text-muted)]">
          <p className="text-lg">No scores submitted yet for these categories.</p>
        </div>
      ) : isSingle && singleCategoryRanks.length === 0 ? (
        <div className="text-center py-12 text-[var(--color-text-muted)]">
          <p className="text-lg">No scores submitted yet for this category.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-sm">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[var(--color-bg)] border-b border-[var(--color-border)]">
                <th className="sticky left-0 bg-[var(--color-bg)] text-center py-2 px-2 text-xs font-semibold text-[var(--color-text-muted)] w-12">Rank</th>
                <th className="sticky left-0 bg-[var(--color-bg)] text-left py-2 px-3 text-xs font-semibold text-[var(--color-text-muted)] min-w-[140px]" style={{ left: '48px' }}>Contestant</th>
                {isCross ? (
                  <>
                    {qualifyingCatIds.map(catId => {
                      const cat = categories.find(c => c.id === catId);
                      const max = cat?.criteria?.reduce((s, c) => s + c.max_score, 0) || 0;
                      return (
                        <th key={catId} className="text-center py-2 px-3 text-xs font-semibold text-[var(--color-text-muted)] border-l border-[var(--color-border)] min-w-[80px]">
                          {cat?.name || `Cat ${catId}`}<br /><span className="opacity-60">{cat?.weight !== undefined ? `(${(cat.weight * 100).toFixed(0)}%) ` : ''}0–{max}</span>
                        </th>
                      );
                    })}
                    <th className="text-center py-2 px-3 text-xs font-semibold text-[var(--color-text-muted)] border-l border-[var(--color-border)] min-w-[80px]">
                      W. Avg<br /><span className="opacity-60">weighted</span>
                    </th>
                  </>
                ) : (
                  <>
                    {judges.map(j => (
                      <th key={j.id} className="text-center py-2 px-3 text-xs font-semibold text-[var(--color-text-muted)] border-l border-[var(--color-border)] min-w-[80px]">
                        {j.name}<br /><span className="opacity-60">Total</span>
                      </th>
                    ))}
                    <th className="text-center py-2 px-3 text-xs font-semibold text-[var(--color-text-muted)] border-l border-[var(--color-border)] min-w-[80px]">
                      Avg<br /><span className="opacity-60">0–100</span>
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {(isCross ? crossCategoryRanks : singleCategoryRanks).map((item, idx) => {
                const c = item.contestant;
                const isQualifier = isCross && round && item.rank <= round.contestant_count;
                const drawCutLine = isCross && round && isQualifier && idx < crossCategoryRanks.length - 1 &&
                  crossCategoryRanks[idx + 1].rank > round.contestant_count;

                return (
                  <tr key={c.id} className={`border-b border-[var(--color-border)] hover:bg-[var(--color-bg)] transition-colors ${isQualifier ? 'bg-green-500/[0.04]' : ''}`}>
                    <td className={`sticky left-0 bg-[var(--color-bg-elevated)] text-center py-2 px-2 text-sm font-bold ${isQualifier ? 'text-emerald-700' : 'text-[var(--color-text)]'}`}>{item.rank}</td>
                    <td className="sticky left-0 bg-[var(--color-bg-elevated)] text-left py-2 px-3 text-sm font-medium text-[var(--color-text)] whitespace-nowrap" style={{ left: '48px' }}>
                      #{c.number} {c.name}
                    </td>
                    {isCross ? (
                      <>
                        {qualifyingCatIds.map(catId => {
                          const total = categoryTotal(catId, c.id);
                          const cellKey = `${catId}:c:${c.id}`;
                          return (
                            <td key={cellKey} className={`text-center py-2 px-3 text-sm font-mono border-l border-[var(--color-border)] transition-all duration-300 ${highlightedCells.has(cellKey) ? 'bg-emerald-200/40' : ''}`}>
                              {total !== null ? Math.round(total) : '—'}
                            </td>
                          );
                        })}
                        <td className="text-center py-2 px-3 text-sm font-bold font-mono text-[var(--color-text)] border-l border-[var(--color-border)]">
                          {Math.round(item.weighted_total * 10) / 10}
                        </td>
                      </>
                    ) : (
                      <>
                        {judges.map(j => {
                          const total = judgeTotal(j.id, c.id);
                          const cellKey = `s:${j.id}:${c.id}`;
                          return (
                            <td key={cellKey} className={`text-center py-2 px-3 text-sm font-mono border-l border-[var(--color-border)] transition-all duration-300 ${highlightedCells.has(cellKey) ? 'bg-emerald-200/40' : ''}`}>
                              {total !== null ? Math.round(total) : '—'}
                            </td>
                          );
                        })}
                        <td className="text-center py-2 px-3 text-sm font-bold font-mono text-[var(--color-text)] border-l border-[var(--color-border)]">
                          {contestantAvg(c.id) !== null ? Math.round(contestantAvg(c.id)) : '—'}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {isCross && round && crossCategoryRanks.some((item, idx) => {
            const q = item.rank <= round.contestant_count;
            const nextOut = idx < crossCategoryRanks.length - 1 && crossCategoryRanks[idx + 1].rank > round.contestant_count;
            return q && nextOut;
          }) && <div className="border-t-2 border-dashed border-amber-400 mx-2 mb-2" />}
        </div>
      )}
    </div>
  );
}
