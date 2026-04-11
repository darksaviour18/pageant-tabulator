import { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2, Users, ChevronDown, ChevronRight, X } from 'lucide-react';
import { eliminationRoundsAPI } from '../api';
import { reportsAPI } from '../api';

/**
 * QualifierSelector Modal — auto-select by rank or manual override.
 */
function QualifierSelector({ event, reportData, onClose, onCreate }) {
  const [roundName, setRoundName] = useState('Top 10');
  const [contestantCount, setContestantCount] = useState(10);
  const [autoSelect, setAutoSelect] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(false);

  // Build ranked list from cross-category report
  const rankedContestants = reportData?.contestants || [];

  useEffect(() => {
    if (autoSelect) {
      const ids = new Set(rankedContestants.slice(0, contestantCount).map((c) => c.id));
      setSelectedIds(ids);
    }
  }, [autoSelect, contestantCount, rankedContestants]);

  const toggleContestant = (id) => {
    setAutoSelect(false);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (selectedIds.size === 0) return;
    setLoading(true);
    try {
      // Determine the based_on_report_id if report was saved
      const qualifiers = rankedContestants
        .filter((c) => selectedIds.has(c.id))
        .map((c) => ({ contestant_id: c.id, rank: c.overall_rank }));

      await onCreate({
        event_id: event.id,
        round_name: roundName.trim(),
        round_order: 1,
        contestant_count: selectedIds.size,
        qualifiers,
      });
      onClose();
    } catch (err) {
      console.error('Failed to create round:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between bg-slate-50 px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Create Elimination Round</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Round Name</label>
            <input
              type="text"
              value={roundName}
              onChange={(e) => setRoundName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
              placeholder="e.g., Top 10, Semi-Finals"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Advance</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={contestantCount}
                onChange={(e) => setContestantCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                min="1"
              />
              <span className="text-sm text-slate-500">contestants</span>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoSelect}
              onChange={(e) => setAutoSelect(e.target.checked)}
              className="text-amber-600 focus:ring-amber-500"
            />
            Auto-select top {contestantCount} by rank
          </label>

          <div>
            <h4 className="text-sm font-medium text-slate-700 mb-2">
              {selectedIds.size} selected
            </h4>
            <div className="space-y-1 max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2">
              {rankedContestants.map((c) => {
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
                    <span className="text-xs text-slate-400 w-8">#{c.overall_rank}</span>
                    <span className="font-medium text-slate-900">#{c.number} {c.name}</span>
                    {c.total_rank !== undefined && (
                      <span className="text-xs text-slate-400 ml-auto">Total rank: {c.total_rank}</span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 bg-slate-50 border-t border-slate-200">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
          <button
            onClick={handleCreate}
            disabled={loading || selectedIds.size === 0}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create Round
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * EliminationRoundManager — displays rounds and allows creating new ones.
 */
export default function EliminationRoundManager({ eventId, reportData }) {
  const [rounds, setRounds] = useState([]);
  const [expandedRound, setExpandedRound] = useState(null);
  const [roundQualifiers, setRoundQualifiers] = useState({});
  const [loading, setLoading] = useState(true);
  const [showQualifierModal, setShowQualifierModal] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadRounds();
  }, [eventId]);

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
        setRoundQualifiers((prev) => ({ ...prev, [round.id]: res.data.qualifiers }));
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
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create round');
    }
  };

  const handleDeleteRound = async (roundId) => {
    if (!confirm('Delete this elimination round and its qualifiers?')) return;
    try {
      await eliminationRoundsAPI.delete(roundId);
      setRounds((prev) => prev.filter((r) => r.id !== roundId));
      setExpandedRound(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete round');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Elimination Rounds</h3>
        {reportData && (
          <button
            onClick={() => setShowQualifierModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Round
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
          No elimination rounds yet. Generate a cross-category report and click "Create Round".
        </div>
      ) : (
        <div className="space-y-2">
          {rounds.map((round) => {
            const qualifiers = roundQualifiers[round.id] || [];
            const isExpanded = expandedRound === round.id;
            return (
              <div key={round.id} className="border border-slate-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => handleToggleExpand(round)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    <div className="text-left">
                      <span className="text-sm font-medium text-slate-900">{round.round_name}</span>
                      <span className="text-xs text-slate-400 ml-2">{round.contestant_count} contestants</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteRound(round.id);
                    }}
                    className="text-slate-400 hover:text-red-600 transition-colors p-1"
                    title="Delete round"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </button>

                {isExpanded && (
                  <div className="px-4 py-3 border-t border-slate-200">
                    {qualifiers.length === 0 ? (
                      <div className="text-sm text-slate-400">Loading qualifiers...</div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {qualifiers.map((q) => (
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
                )}
              </div>
            );
          })}
        </div>
      )}

      {showQualifierModal && reportData && (
        <QualifierSelector
          event={{ id: eventId }}
          reportData={reportData}
          onClose={() => setShowQualifierModal(false)}
          onCreate={handleCreateRound}
        />
      )}
    </div>
  );
}
