import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Loader2, Users, ChevronDown, ChevronRight, X } from 'lucide-react';
import { eliminationRoundsAPI, categoriesAPI, contestantsAPI } from '../api';

export function QualifierSelector({ event, reportData, editingRound, onClose, onCreate }) {
  const isEditMode = !!editingRound;
  const [roundName, setRoundName] = useState(editingRound?.round_name || 'Top 10');
  const [contestantCount, setContestantCount] = useState(editingRound?.contestant_count || 10);
  const [autoSelect, setAutoSelect] = useState(!isEditMode);
  const [selectedIds, setSelectedIds] = useState(() => {
    return new Set();
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const rankedContestants = useMemo(() => reportData?.contestants || [], [reportData?.contestants]);
  const isUnranked = rankedContestants.length > 0 && rankedContestants[0].overall_rank === undefined;

  useEffect(() => {
    if (isEditMode && editingRound) {
      const ids = new Set(rankedContestants.slice(0, contestantCount).map(c => c.id));
      setSelectedIds(ids);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (autoSelect) {
      const ids = new Set(rankedContestants.slice(0, contestantCount).map(c => c.id));
      setSelectedIds(ids);
    }
  }, [autoSelect, contestantCount, rankedContestants]);

  const toggleContestant = (id) => {
    setAutoSelect(false);
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedIds.size === 0) return;
    setLoading(true);
    setError(null);
    try {
      const qualifiers = rankedContestants
        .filter(c => selectedIds.has(c.id))
        .map((c, idx) => ({ contestant_id: c.id, rank: c.overall_rank || idx + 1 }));

      await onCreate({
        event_id: event.id,
        round_name: roundName.trim(),
        contestant_count: selectedIds.size,
        qualifiers,
      });
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to save round');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between bg-slate-50 px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">
            {isEditMode ? `Edit Qualifiers — ${editingRound.round_name}` : 'Create Elimination Round'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {!isEditMode && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Round Name</label>
              <input
                type="text"
                value={roundName}
                onChange={e => setRoundName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                placeholder="e.g., Top 10, Semi-Finals, Grand Finals"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {isEditMode ? 'Number of qualifiers' : 'Advance'}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={contestantCount}
                onChange={e => setContestantCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                min="1"
                max={rankedContestants.length}
              />
              <span className="text-sm text-slate-500">
                of {rankedContestants.length} contestants
              </span>
            </div>
          </div>

          {!isUnranked && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={autoSelect}
                onChange={e => setAutoSelect(e.target.checked)}
                className="text-amber-600 focus:ring-amber-500"
              />
              Auto-select top {contestantCount} by rank
            </label>
          )}

          {!isUnranked && (() => {
            const sorted = [...rankedContestants];
            const cutContestant = sorted[contestantCount - 1];
            const nextContestant = sorted[contestantCount];
            if (
              cutContestant && nextContestant &&
              cutContestant.overall_rank === nextContestant.overall_rank
            ) {
              return (
                <div className="text-xs text-orange-600 bg-orange-50 border border-orange-200 px-3 py-2 rounded-lg">
                  ⚠ Tie detected: contestants ranked #{cutContestant.overall_rank} are tied at the cut
                  line. Manually select which ones advance, or adjust the count to include all tied contestants.
                </div>
              );
            }
            return null;
          })()}

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-slate-700">
                {selectedIds.size} selected
              </h4>
              {selectedIds.size !== contestantCount && (
                <span className="text-xs text-orange-500">
                  Count doesn't match — adjust above or select manually
                </span>
              )}
            </div>
            <div className="space-y-1 max-h-56 overflow-y-auto border border-slate-200 rounded-lg p-2">
              {rankedContestants.map(c => {
                const checked = selectedIds.has(c.id);
                return (
                  <label
                    key={c.id}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm transition-colors ${
                      checked ? 'bg-amber-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleContestant(c.id)}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    {!isUnranked && <span className="text-xs text-slate-400 w-8">#{c.overall_rank}</span>}
                    <span className={`font-medium text-slate-900 ${isUnranked ? 'ml-0' : ''}`}>#{c.number} {c.name}</span>
                    <span className="text-xs text-slate-400 ml-auto">
                      {typeof c.weighted_total === 'number' ? c.weighted_total.toFixed(3) : ''}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 bg-slate-50 border-t border-slate-200">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || selectedIds.size === 0 || (!isEditMode && !roundName.trim())}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {isEditMode ? 'Save Qualifiers' : 'Create Round'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EliminationRoundManager({ eventId, reportData, categories = [], onRoundCreated, standalone = false }) {
  const [rounds, setRounds] = useState([]);
  const [expandedRound, setExpandedRound] = useState(null);
  const [roundQualifiers, setRoundQualifiers] = useState({});
  const [loading, setLoading] = useState(true);
  const [showQualifierModal, setShowQualifierModal] = useState(false);
  const [editingRound, setEditingRound] = useState(null);
  const [error, setError] = useState(null);
  const [linkingBusy, setLinkingBusy] = useState(false);
  const [standaloneContestants, setStandaloneContestants] = useState([]);

  useEffect(() => {
    loadRounds();
  }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (standalone && eventId) {
      contestantsAPI.getAll(eventId, { status: 'active' })
        .then(res => setStandaloneContestants(res.data || []))
        .catch(() => {});
    }
  }, [standalone, eventId]);

  const loadRounds = async () => {
    setLoading(true);
    try {
      const res = await eliminationRoundsAPI.getAll(eventId);
      setRounds(res.data);
    } catch (err) {
      console.error('Failed to load rounds:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleExpand = async (round) => {
    if (expandedRound === round.id) {
      setExpandedRound(null);
      return;
    }
    setExpandedRound(round.id);
    if (!roundQualifiers[round.id]) {
      try {
        const res = await eliminationRoundsAPI.getQualifiers(round.id);
        setRoundQualifiers(prev => ({ ...prev, [round.id]: res.data.qualifiers }));
      } catch (err) {
        console.error('Failed to load qualifiers:', err);
      }
    }
  };

  const handleCreateRound = async (data) => {
    setError(null);
    try {
      await eliminationRoundsAPI.create(data);
      await loadRounds();
      if (onRoundCreated) onRoundCreated();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create round');
    }
  };

  const handleDeleteRound = async (roundId) => {
    const round = rounds.find(r => r.id === roundId);
    const linkedCount = round?.linked_categories?.length || 0;
    const warning = linkedCount > 0
      ? `This round is linked to ${linkedCount} categor${linkedCount === 1 ? 'y' : 'ies'}. Deleting it will restore all contestants to those categories. Continue?`
      : 'Delete this elimination round and its qualifiers?';
    if (!confirm(warning)) return;

    try {
      await eliminationRoundsAPI.delete(eventId, roundId);
      setRounds(prev => prev.filter(r => r.id !== roundId));
      setExpandedRound(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete round');
    }
  };

  const handleToggleCategoryLink = async (round, cat, isCurrentlyLinked) => {
    setError(null);
    setLinkingBusy(true);
    try {
      await categoriesAPI.setRequiredRound(eventId, cat.id, isCurrentlyLinked ? null : round.id);
      await loadRounds();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update category link');
    } finally {
      setLinkingBusy(false);
    }
  };

  const handleEditQualifiers = (round) => {
    setEditingRound(round);
    setShowQualifierModal(true);
  };

  const handleSaveQualifiers = async (data) => {
    setError(null);
    try {
      if (editingRound) {
        const res = await eliminationRoundsAPI.updateQualifiers(editingRound.id, {
          qualifiers: data.qualifiers,
          contestant_count: data.qualifiers.length,
        });
        setRoundQualifiers(prev => ({ ...prev, [editingRound.id]: res.data }));
        await loadRounds();
      } else {
        await handleCreateRound(data);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save round');
      throw err;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
          Elimination Rounds
        </h3>
        {(reportData || standalone) && (
          <button
            onClick={() => { setEditingRound(null); setShowQualifierModal(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            {standalone ? 'Create Round' : 'Create Round from Report'}
          </button>
        )}
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-8 text-slate-400">Loading rounds...</div>
      ) : rounds.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">
          No elimination rounds yet.
          Click "Create Round" to create one.
        </div>
      ) : (
        <div className="space-y-2">
          {rounds.map((round) => {
            const qualifiers = roundQualifiers[round.id] || [];
            const isExpanded = expandedRound === round.id;
            const linkedCats = round.linked_categories || [];

            return (
              <div key={round.id} className="border border-slate-200 rounded-lg overflow-hidden">
                <div
                  onClick={() => handleToggleExpand(round)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    {isExpanded
                      ? <ChevronDown className="w-4 h-4 text-slate-400" />
                      : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    <div className="text-left">
                      <span className="text-sm font-medium text-slate-900">{round.round_name}</span>
                      <span className="text-xs text-slate-400 ml-2">{round.contestant_count} contestants</span>
                      {linkedCats.length > 0 && (
                        <span className="ml-2 text-xs text-amber-600 font-medium">
                          → gates {linkedCats.map(c => c.name).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleEditQualifiers(round)}
                      className="text-slate-400 hover:text-blue-600 transition-colors p-1"
                      title="Edit qualifiers"
                    >
                      <Users className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteRound(round.id)}
                      className="text-slate-400 hover:text-red-600 transition-colors p-1"
                      title="Delete round"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 py-3 border-t border-slate-200 space-y-4">
                    <div>
                      <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                        Qualifiers
                      </h5>
                      {qualifiers.length === 0 ? (
                        <div className="text-sm text-slate-400">Loading qualifiers...</div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {qualifiers.map(q => (
                            <div key={q.contestant_id} className="flex items-center gap-2 text-sm">
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                                {q.qualified_rank}
                              </span>
                              <span className="text-slate-700">#{q.number} {q.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {categories.length > 0 && (
                      <div className="border-t border-slate-100 pt-3">
                        <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                          Gate Scoring Categories
                        </h5>
                        <p className="text-xs text-slate-400 mb-2">
                          Judges will only see the {round.contestant_count} qualifiers when scoring checked categories.
                        </p>
                        <div className="space-y-1">
                          {categories.map(cat => {
                            const isLinked = linkedCats.some(lc => lc.id === cat.id);
                            const linkedElsewhere = rounds.find(
                              r => r.id !== round.id && r.linked_categories?.some(lc => lc.id === cat.id)
                            );
                            return (
                              <label
                                key={cat.id}
                                className={`flex items-center gap-2 text-sm px-2 py-1.5 rounded transition-colors ${
                                  linkingBusy ? 'opacity-50 cursor-wait' : 'cursor-pointer hover:bg-slate-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isLinked}
                                  disabled={linkingBusy}
                                  onChange={() => handleToggleCategoryLink(round, cat, isLinked)}
                                  className="text-amber-600 focus:ring-amber-500"
                                />
                                <span className={isLinked ? 'text-slate-900 font-medium' : 'text-slate-600'}>
                                  {cat.name}
                                </span>
                                {isLinked && (
                                  <span className="text-xs text-amber-600 ml-auto">✓ Filtered</span>
                                )}
                                {linkedElsewhere && !isLinked && (
                                  <span className="text-xs text-orange-500 ml-auto" title={`Currently linked to "${linkedElsewhere.round_name}"`}>
                                    ⚠ Other round
                                  </span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showQualifierModal && (reportData || standalone) && (
        <QualifierSelector
          event={{ id: eventId }}
          reportData={reportData || { contestants: standaloneContestants }}
          editingRound={editingRound}
          onClose={() => { setShowQualifierModal(false); setEditingRound(null); }}
          onCreate={handleSaveQualifiers}
        />
      )}
    </div>
  );
}
