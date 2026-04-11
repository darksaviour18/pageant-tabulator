import { useState, useEffect } from 'react';
import { eventsAPI, categoriesAPI } from '../api';
import { reportsAPI, eliminationRoundsAPI } from '../api';
import { Crown, Printer, Loader2, Calendar, Users, Award } from 'lucide-react';
import EliminationRoundManager from '../components/EliminationRoundManager';

const REPORT_TYPES = [
  { id: 'category_detail', label: 'Category Detail (Per-Category Scores)' },
  { id: 'cross_category', label: 'Cross-Category Consolidation (Rank Summary)' },
];

export default function PrintReport() {
  const [report, setReport] = useState(null);
  const [reportType, setReportType] = useState('category_detail');
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState('');
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [selectedRoundId, setSelectedRoundId] = useState('');
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    eventsAPI.getAll().then((res) => setEvents(res.data || [])).catch(console.error);
  }, []);

  const handleEventChange = async (e) => {
    const id = e.target.value;
    setEventId(id);
    setSelectedCategoryId('');
    setSelectedCategoryIds([]);
    setSelectedRoundId('');
    setRounds([]);
    setReport(null);
    setError(null);

    if (id) {
      try {
        const [catsRes, roundsRes] = await Promise.all([
          categoriesAPI.getAll(parseInt(id, 10)),
          eliminationRoundsAPI.getAll(parseInt(id, 10)),
        ]);
        setCategories(catsRes.data || []);
        setRounds(roundsRes.data || []);
      } catch (err) {
        console.error('Failed to load data:', err);
      }
    }
  };

  const handleReportTypeChange = (e) => {
    setReportType(e.target.value);
    setReport(null);
    setError(null);
  };

  const handleGenerate = async () => {
    setError(null);
    setLoading(true);

    try {
      let res;
      if (reportType === 'category_detail') {
        if (!eventId || !selectedCategoryId) {
          setError('Please select a category');
          setLoading(false);
          return;
        }
        res = await reportsAPI.getReport(parseInt(eventId, 10), parseInt(selectedCategoryId, 10));
      } else {
        if (!eventId || selectedCategoryIds.length === 0) {
          setError('Please select at least one category');
          setLoading(false);
          return;
        }
        res = await reportsAPI.getCrossCategoryReport(parseInt(eventId, 10), {
          category_ids: selectedCategoryIds,
          report_title: 'OVERALL PRELIMINARY SCORES',
        });
      }
      setReport(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handleRoundCreated = async () => {
    if (!eventId) return;
    try {
      const res = await eliminationRoundsAPI.getAll(parseInt(eventId, 10));
      setRounds(res.data || []);
    } catch (err) {
      console.error('Failed to refresh rounds:', err);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Controls - hidden when printing */}
      <div className="no-print space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-slate-900">Reports & Printing</h2>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          {/* Report Type Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Report Type</label>
            <select
              value={reportType}
              onChange={handleReportTypeChange}
              className="px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none bg-white min-w-[250px]"
            >
              {REPORT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Event</label>
            <select
              value={eventId}
              onChange={handleEventChange}
              className="px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none bg-white min-w-[200px]"
            >
              <option value="">Select event...</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>

          {reportType === 'category_detail' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                disabled={!eventId}
                className="px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none bg-white min-w-[200px] disabled:bg-slate-100"
              >
                <option value="">Select category...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {reportType === 'cross_category' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Categories</label>
              <div className="flex flex-wrap gap-2 p-2 border border-slate-300 rounded-lg bg-white min-w-[300px]">
                {categories.length === 0 && (
                  <span className="text-sm text-slate-400">Select an event first</span>
                )}
                {categories.map((c) => {
                  const checked = selectedCategoryIds.includes(c.id);
                  return (
                    <label key={c.id} className="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setSelectedCategoryIds((prev) =>
                            e.target.checked
                              ? [...prev, c.id]
                              : prev.filter((id) => id !== c.id)
                          );
                        }}
                        className="text-amber-600 focus:ring-amber-500"
                      />
                      {c.name}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {rounds.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Filter by Round</label>
              <select
                value={selectedRoundId}
                onChange={(e) => setSelectedRoundId(e.target.value)}
                className="px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none bg-white min-w-[200px]"
              >
                <option value="">All contestants</option>
                {rounds.map((r) => (
                  <option key={r.id} value={r.id}>{r.round_name} ({r.contestant_count})</option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={loading || !eventId || (reportType === 'category_detail' && !selectedCategoryId) || (reportType === 'cross_category' && selectedCategoryIds.length === 0)}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
            Generate Report
          </button>

          {report && (
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-lg transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
          )}
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{error}</div>
        )}
      </div>

      {/* Report Content */}
      {report && (
        <div id="print-report" className="print-report bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          {reportType === 'category_detail' ? (
            <CategoryDetailReport report={report} event={events.find((e) => e.id === parseInt(eventId))} />
          ) : (
            <CrossCategoryReport report={report} event={events.find((e) => e.id === parseInt(eventId))} />
          )}
        </div>
      )}

      {/* Elimination Rounds — shown after cross-category report */}
      {reportType === 'cross_category' && report && eventId && (
        <EliminationRoundManager
          eventId={parseInt(eventId, 10)}
          reportData={report}
          onRoundCreated={handleRoundCreated}
        />
      )}
    </div>
  );
}

/**
 * Category Detail Report (existing per-category report)
 */
function CategoryDetailReport({ report, event }) {
  return (
    <>
      <div className="text-center mb-8 border-b-2 border-slate-900 pb-6">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">PAGEANT TABULATOR PRO</h1>
        <h2 className="text-xl font-semibold text-slate-700 mt-2">OFFICIAL SCORE SHEET — {report.category.name.toUpperCase()}</h2>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-slate-400" />
          <span className="text-slate-500">Event:</span>
          <span className="font-medium text-slate-900">{event?.name || 'Event'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-slate-500">Date:</span>
          <span className="font-medium text-slate-900">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      <div className="mb-8 border-t border-b border-slate-200 py-4">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Criteria & Weights</h3>
        <div className="grid grid-cols-2 gap-2">
          {report.criteria.map((c) => (
            <div key={c.id} className="flex items-center justify-between text-sm">
              <span className="text-slate-700 font-medium">{c.name}</span>
              <span className="text-slate-500">{(c.weight * 100).toFixed(0)}% (Range: {c.min_score}–{c.max_score})</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Detailed Scores</h3>
        <table className="w-full text-sm border-collapse border border-slate-300">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-300 px-3 py-2 text-left font-semibold text-slate-700">#</th>
              <th className="border border-slate-300 px-3 py-2 text-left font-semibold text-slate-700">Contestant</th>
              {report.criteria.map((c) => (
                <th key={c.id} className="border border-slate-300 px-3 py-2 text-center font-semibold text-slate-700">{c.name}</th>
              ))}
              <th className="border border-slate-300 px-3 py-2 text-center font-semibold text-slate-700">Total</th>
            </tr>
          </thead>
          <tbody>
            {report.rankings.map((r, idx) => (
              <tr key={r.contestant_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                <td className="border border-slate-300 px-3 py-2 text-center font-mono text-sm">{r.contestant_number}</td>
                <td className="border border-slate-300 px-3 py-2 font-medium">{r.contestant_name}</td>
                {report.criteria.map((c) => {
                  const scores = report.scores.filter((s) => s.contestant_id === r.contestant_id && s.criteria_id === c.id);
                  const avg = scores.length > 0 ? (scores.reduce((sum, s) => sum + s.score, 0) / scores.length).toFixed(2) : '—';
                  return <td key={c.id} className="border border-slate-300 px-3 py-2 text-center">{avg}</td>;
                })}
                <td className="border border-slate-300 px-3 py-2 text-center font-bold">{r.total_score.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-8">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2"><Award className="w-4 h-4" /> Final Rankings</h3>
        <table className="w-full text-sm border-collapse border border-slate-300">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="border border-slate-600 px-3 py-2 text-center">Rank</th>
              <th className="border border-slate-600 px-3 py-2 text-left">#</th>
              <th className="border border-slate-600 px-3 py-2 text-left">Contestant</th>
              <th className="border border-slate-600 px-3 py-2 text-right">Total Score</th>
            </tr>
          </thead>
          <tbody>
            {report.rankings.map((r) => (
              <tr key={r.contestant_id} className="bg-white">
                <td className="border border-slate-300 px-3 py-2 text-center font-bold text-lg">
                  {r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : `#${r.rank}`}
                </td>
                <td className="border border-slate-300 px-3 py-2 text-center">{r.contestant_number}</td>
                <td className="border border-slate-300 px-3 py-2 font-medium">{r.contestant_name}</td>
                <td className="border border-slate-300 px-3 py-2 text-right font-bold font-mono">{r.total_score.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-8">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2"><Users className="w-4 h-4" /> Judges</h3>
        <div className="grid grid-cols-2 gap-2">
          {report.judges.map((j) => (
            <div key={j.id} className="text-sm"><span className="font-medium">{j.name}</span><span className="text-slate-400 ml-2">(Seat #{j.seat_number})</span></div>
          ))}
        </div>
      </div>

      <div className="mt-16 pt-8 border-t border-slate-300">
        <div className="grid grid-cols-3 gap-8">
          <div><div className="border-b border-slate-400 pb-1 mb-1">&nbsp;</div><p className="text-xs text-slate-500 text-center">Head Judge</p></div>
          <div><div className="border-b border-slate-400 pb-1 mb-1">&nbsp;</div><p className="text-xs text-slate-500 text-center">Tabulator</p></div>
          <div><div className="border-b border-slate-400 pb-1 mb-1">&nbsp;</div><p className="text-xs text-slate-500 text-center">Event Director</p></div>
        </div>
      </div>
    </>
  );
}

/**
 * Cross-Category Consolidation Report
 */
function CrossCategoryReport({ report, event }) {
  return (
    <>
      <div className="text-center mb-8 border-b-2 border-slate-900 pb-6">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">PAGEANT TABULATOR PRO</h1>
        <h2 className="text-xl font-semibold text-slate-700 mt-2">{report.title}</h2>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-slate-400" />
          <span className="text-slate-500">Event:</span>
          <span className="font-medium text-slate-900">{event?.name || 'Event'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-slate-500">Date:</span>
          <span className="font-medium text-slate-900">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      <div className="mb-8 border-t border-b border-slate-200 py-4">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Categories Included</h3>
        <div className="flex flex-wrap gap-3">
          {report.categories.map((c) => (
            <span key={c.id} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-700">{c.name}</span>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-2">Note: Rankings are from individual categories. Total is sum of ranks. Lower total rank = better placement.</p>
      </div>

      <div className="mb-8">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2"><Award className="w-4 h-4" /> Final Rankings</h3>
        <table className="w-full text-sm border-collapse border border-slate-300">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="border border-slate-600 px-3 py-2 text-center">Overall Rank</th>
              <th className="border border-slate-600 px-3 py-2 text-left">#</th>
              <th className="border border-slate-600 px-3 py-2 text-left">Contestant</th>
              {report.categories.map((c) => (
                <th key={c.id} className="border border-slate-600 px-3 py-2 text-center text-xs">{c.name}</th>
              ))}
              <th className="border border-slate-600 px-3 py-2 text-center font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {report.contestants.map((c, idx) => (
              <tr key={c.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                <td className="border border-slate-300 px-3 py-2 text-center font-bold text-lg">
                  {c.overall_rank === 1 ? '🥇' : c.overall_rank === 2 ? '🥈' : c.overall_rank === 3 ? '🥉' : `#${c.overall_rank}`}
                </td>
                <td className="border border-slate-300 px-3 py-2 text-center font-mono">{c.number}</td>
                <td className="border border-slate-300 px-3 py-2 font-medium">{c.name}</td>
                {report.categories.map((cat) => (
                  <td key={cat.id} className="border border-slate-300 px-3 py-2 text-center font-mono">
                    {c.category_ranks[cat.id] !== undefined ? c.category_ranks[cat.id] : '—'}
                  </td>
                ))}
                <td className="border border-slate-300 px-3 py-2 text-center font-bold">{c.total_rank}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-16 pt-8 border-t border-slate-300">
        <div className="grid grid-cols-3 gap-8">
          <div><div className="border-b border-slate-400 pb-1 mb-1">&nbsp;</div><p className="text-xs text-slate-500 text-center">Head Judge</p></div>
          <div><div className="border-b border-slate-400 pb-1 mb-1">&nbsp;</div><p className="text-xs text-slate-500 text-center">Tabulator</p></div>
          <div><div className="border-b border-slate-400 pb-1 mb-1">&nbsp;</div><p className="text-xs text-slate-500 text-center">Event Director</p></div>
        </div>
      </div>
    </>
  );
}
