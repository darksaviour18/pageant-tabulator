import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { eventsAPI, categoriesAPI, eliminationRoundsAPI, scoresAPI } from '../api';
import { useSocket } from '../context/SocketContext';
import { Eye, Wifi, WifiOff } from 'lucide-react';

export default function LiveScores() {
  const { onEvent, connected, lastSync } = useSocket();
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState('');
  const [rounds, setRounds] = useState([]);
  const [selectedRoundId, setSelectedRoundId] = useState('');
  const [judges, setJudges] = useState([]);
  const [contestants, setContestants] = useState([]);
  const [categories, setCategories] = useState([]);
  const [qualifyingCatIds, setQualifyingCatIds] = useState([]);
  const [catData, setCatData] = useState({}); // { catId: { scores, criteria, scoringMode } }
  const [scoringMode, setScoringMode] = useState('direct');
  const [loading, setLoading] = useState(true);
  const [round, setRound] = useState(null);
  const [highlightedCells, setHighlightedCells] = useState(new Set());
  const abortRef = useRef(false);
  const catDataRef = useRef(catData);

  useEffect(() => {
    abortRef.current = false;
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
    return () => { abortRef.current = true; };
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
    setCatData({});
    setRound(null);
    setContestants([]);
    setQualifyingCatIds([]);
    if (id) {
      setLoading(true);
      await Promise.all([loadRounds(id), loadJudges(id)]);
      setLoading(false);
    }
  };

  const handleRoundChange = async (e) => {
    const rId = e.target.value;
    setSelectedRoundId(rId);
    setCatData({});
    setContestants([]);

    if (!rId) { setRound(null); setQualifyingCatIds([]); return; }

    setLoading(true);
    try {
      const r = rounds.find(rr => rr.id === parseInt(rId));
      if (!r) { setLoading(false); return; }
      setRound(r);

      let qIds;
      if (Array.isArray(r.qualifying_category_ids)) {
        qIds = r.qualifying_category_ids;
      } else if (typeof r.qualifying_category_ids === 'string') {
        qIds = JSON.parse(r.qualifying_category_ids);
      } else {
        qIds = [];
      }
      setQualifyingCatIds(qIds);

      if (!qIds.length) { setLoading(false); return; }

      // Fetch scores for ALL qualifying categories in parallel
      const scorePromises = qIds.map(catId =>
        scoresAPI.getAllByEventAndCategory(parseInt(eventId, 10), catId)
          .then(res => ({ catId, data: res.data || [] }))
          .catch(() => ({ catId, data: [] }))
      );

      // Fetch event scoring mode once
      const evRes = await eventsAPI.getById(parseInt(eventId, 10));
      const mode = evRes.data?.scoring_mode || 'direct';
      setScoringMode(mode);

      const scoreResults = await Promise.all(scorePromises);

      const data = {};
      const contestantSet = new Set();

      // Build per-category score matrices
      for (const { catId, data: rawScores } of scoreResults) {
        const matrix = {};
        for (const s of rawScores) {
          if (!matrix[s.judge_id]) matrix[s.judge_id] = {};
          if (!matrix[s.judge_id][s.contestant_id]) matrix[s.judge_id][s.contestant_id] = {};
          matrix[s.judge_id][s.contestant_id][s.criteria_id] = s.score;
          contestantSet.add(s.contestant_id);
        }

        // Get criteria for this category
        const cat = categories.find(c => c.id === catId);
        data[catId] = {
          scores: matrix,
          criteria: cat?.criteria || [],
          maxScore: (cat?.criteria || []).reduce((s, crit) => s + crit.max_score, 0),
          scoringMode: mode,
        };
      }

      setCatData(data);
      catDataRef.current = data;

      // Build contestant list (intersection of all qualifying categories + round qualifiers)
      // Use the first qualifying category's context to get contestants
      const { scoringAPI } = await import('../api');
      if (judges.length > 0) {
        const ctxRes = await scoringAPI.getContext(judges[0].id, parseInt(eventId, 10));
        const allContestants = ctxRes.data?.contestants || [];
        setContestants(allContestants.filter(c => contestantSet.has(c.id)));
      }
    } catch (err) {
      console.error('[LiveScores] Failed to load round data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Compute per-category total for a contestant (sum across all judges)
  const categoryTotal = useCallback((catId, contestantId) => {
    const d = catData[catId];
    if (!d) return null;
    let total = 0, hasScore = false;
    for (const crit of d.criteria) {
      for (const judgeId of Object.keys(d.scores)) {
        const val = d.scores[judgeId]?.[contestantId]?.[crit.id];
        if (val !== null && val !== undefined) {
          if (d.scoringMode === 'weighted') {
            total += val * crit.weight;
          } else {
            total += val;
          }
          hasScore = true;
        }
      }
    }
    return hasScore ? total : null;
  }, [catData]);

  // Compute cross-category ranking — identical to server generateCrossCategoryReport
  const crossCategoryRanks = useMemo(() => {
    if (!qualifyingCatIds.length || !contestants.length) return [];

    const catWeight = 1 / qualifyingCatIds.length; // equal weight per category
    const ranked = contestants.map(c => {
      let weightedTotal = 0;
      for (const catId of qualifyingCatIds) {
        const total = categoryTotal(catId, c.id);
        if (total !== null) {
          weightedTotal += total * catWeight;
        }
      }
      return {
        contestant: c,
        weighted_total: Math.round(weightedTotal * 1000) / 1000,
      };
    });

    ranked.sort((a, b) => {
      if (b.weighted_total !== a.weighted_total) return b.weighted_total - a.weighted_total;
      return a.contestant.number - b.contestant.number;
    });

    let currentRank = 1;
    for (let i = 0; i < ranked.length; i++) {
      if (i > 0 && ranked[i].weighted_total < ranked[i - 1].weighted_total) {
        currentRank = i + 1;
      }
      ranked[i].rank = currentRank;
    }
    return ranked;
  }, [qualifyingCatIds, contestants, categoryTotal]);

  // WebSocket listeners
  useEffect(() => {
    if (!selectedRoundId || !eventId) return;

    const unsubScore = onEvent('score_updated', (data) => {
      const catId = data.category_id;
      // Only process events for qualifying categories
      if (!qualifyingCatIds.includes(catId)) return;

      const key = `${catId}:${data.judge_id}:${data.contestant_id}`;
      setCatData(prev => {
        const next = { ...prev };
        if (!next[catId]) return prev;
        const scores = { ...next[catId].scores };
        if (!scores[data.judge_id]) scores[data.judge_id] = {};
        if (!scores[data.judge_id][data.contestant_id]) scores[data.judge_id][data.contestant_id] = {};
        scores[data.judge_id][data.contestant_id] = {
          ...scores[data.judge_id][data.contestant_id],
          [data.criteria_id]: data.score,
        };
        next[catId] = { ...next[catId], scores };
        catDataRef.current = next;
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

    const unsubJudgeConnected = onEvent('judge_connected', () => {
      if (eventId) loadJudges(parseInt(eventId, 10));
    });

    return () => { unsubScore(); unsubJudgeConnected(); };
  }, [onEvent, selectedRoundId, eventId, qualifyingCatIds]);

  // Re-fetch on reconnect
  useEffect(() => {
    if (lastSync && selectedRoundId) {
      handleRoundChange({ target: { value: selectedRoundId } });
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Eye className="w-6 h-6 text-[var(--color-cta)]" />
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text)]">Live Scores</h2>
            <p className="text-xs text-[var(--color-text-muted)]">Real-time cross-category rankings</p>
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
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Elimination Round</label>
          <select value={selectedRoundId} onChange={handleRoundChange}
            className="px-3 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-cta)] outline-none bg-[var(--color-bg-subtle)] text-[var(--color-text)] min-w-[250px] text-sm">
            <option value="">Select a round...</option>
            {rounds.map(r => (
              <option key={r.id} value={r.id}>{r.round_name} ({r.contestant_count} contestants)</option>
            ))}
          </select>
        </div>
        {round && (
          <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
            🏆 {round.round_name} — {round.contestant_count} qualifiers — {qualifyingCatIds.length} categories
          </div>
        )}
      </div>

      {!selectedRoundId ? (
        <div className="text-center py-12 text-[var(--color-text-muted)]">
          <p className="text-lg">Select a round to view live cross-category scores.</p>
          <p className="text-sm mt-1">Rounds define which categories determine qualification.</p>
        </div>
      ) : !qualifyingCatIds.length ? (
        <div className="text-center py-12 text-[var(--color-text-muted)]">
          <p className="text-lg">This round has no qualifying categories configured.</p>
          <p className="text-sm mt-1">Edit the round in the Rounds tab to select which categories determine qualification.</p>
        </div>
      ) : crossCategoryRanks.length === 0 ? (
        <div className="text-center py-12 text-[var(--color-text-muted)]">
          <p className="text-lg">No scores have been submitted yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-sm">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[var(--color-bg)] border-b border-[var(--color-border)]">
                <th className="sticky left-0 bg-[var(--color-bg)] text-center py-2 px-2 text-xs font-semibold text-[var(--color-text-muted)] w-12">Rank</th>
                <th className="sticky left-0 bg-[var(--color-bg)] text-left py-2 px-3 text-xs font-semibold text-[var(--color-text-muted)] min-w-[140px]" style={{ left: '48px' }}>Contestant</th>
                {qualifyingCatIds.map(catId => {
                  const cat = categories.find(c => c.id === catId);
                  const max = cat?.criteria?.reduce((s, crit) => s + crit.max_score, 0) || 0;
                  return (
                    <th key={catId} className="text-center py-2 px-3 text-xs font-semibold text-[var(--color-text-muted)] border-l border-[var(--color-border)] min-w-[80px]">
                      {cat?.name || `Cat ${catId}`}<br />
                      <span className="opacity-60">0–{max}</span>
                    </th>
                  );
                })}
                <th className="text-center py-2 px-3 text-xs font-semibold text-[var(--color-text-muted)] border-l border-[var(--color-border)] min-w-[80px]">
                  W. Avg<br /><span className="opacity-60">weighted</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {crossCategoryRanks.map((item, idx) => {
                const c = item.contestant;
                const isQualifier = round && item.rank <= round.contestant_count;
                const drawCutLine = round && isQualifier && idx < crossCategoryRanks.length - 1 &&
                  crossCategoryRanks[idx + 1].rank > round.contestant_count;

                return (
                  <tr key={c.id} className={`border-b border-[var(--color-border)] hover:bg-[var(--color-bg)] transition-colors ${
                    isQualifier ? 'bg-green-500/[0.04]' : ''
                  }`}>
                    <td className={`sticky left-0 bg-[var(--color-bg-elevated)] text-center py-2 px-2 text-sm font-bold ${
                      isQualifier ? 'text-emerald-700' : 'text-[var(--color-text)]'
                    }`}>{item.rank}</td>
                    <td className="sticky left-0 bg-[var(--color-bg-elevated)] text-left py-2 px-3 text-sm font-medium text-[var(--color-text)] whitespace-nowrap" style={{ left: '48px' }}>
                      #{c.number} {c.name}
                    </td>
                    {qualifyingCatIds.map(catId => {
                      const total = categoryTotal(catId, c.id);
                      const cellKey = `${catId}:c:${c.id}`;
                      const isHighlighted = highlightedCells.has(cellKey);
                      return (
                        <td key={cellKey} className={`text-center py-2 px-3 text-sm font-mono border-l border-[var(--color-border)] transition-all duration-300 ${
                          isHighlighted ? 'bg-emerald-200/40' : ''
                        }`}>
                          {total !== null ? Math.round(total) : '—'}
                        </td>
                      );
                    })}
                    <td className="text-center py-2 px-3 text-sm font-bold font-mono text-[var(--color-text)] border-l border-[var(--color-border)]">
                      {Math.round(item.weighted_total * 10) / 10}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {/* Cut line */}
          {round && crossCategoryRanks.some((item, idx) => {
            const q = item.rank <= round.contestant_count;
            const nextOut = idx < crossCategoryRanks.length - 1 && crossCategoryRanks[idx + 1].rank > round.contestant_count;
            return q && nextOut;
          }) && (
            <div className="border-t-2 border-dashed border-amber-400 mx-2 mb-2" />
          )}
        </div>
      )}
    </div>
  );
}
