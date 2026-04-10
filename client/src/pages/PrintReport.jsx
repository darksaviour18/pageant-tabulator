import { useState, useEffect } from 'react';
import { eventsAPI, categoriesAPI } from '../api';
import { reportsAPI } from '../api';
import { Crown, Printer, Loader2, ArrowLeft, Calendar, Users, Award } from 'lucide-react';

export default function PrintReport() {
  const [report, setReport] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState('');
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    eventsAPI.getAll()
      .then((res) => setEvents(res.data || []))
      .catch((err) => {
        console.error('Failed to load events:', err);
        setError('Failed to load events. Please try again.');
      });
  }, []);

  const handleEventChange = async (e) => {
    const id = e.target.value;
    setEventId(id);
    setCategoryId('');
    setReport(null);

    if (id) {
      try {
        const res = await categoriesAPI.getAll(parseInt(id, 10));
        setCategories(res.data);
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    }
  };

  const handleGenerate = async () => {
    if (!eventId || !categoryId) return;
    setError(null);
    setLoading(true);

    try {
      const res = await reportsAPI.getReport(parseInt(eventId, 10), parseInt(categoryId, 10));
      setReport(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate report');
    } finally {
      setLoading(false);
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

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={!eventId}
              className="px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none bg-white min-w-[200px] disabled:bg-slate-100"
            >
              <option value="">Select category...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || !eventId || !categoryId}
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
          {/* Report Header */}
          <div className="text-center mb-8 border-b-2 border-slate-900 pb-6">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              PAGEANT TABULATOR PRO
            </h1>
            <h2 className="text-xl font-semibold text-slate-700 mt-2">
              OFFICIAL SCORE SHEET — {report.category.name.toUpperCase()}
            </h2>
          </div>

          {/* Event Info */}
          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-slate-400" />
              <span className="text-slate-500">Event:</span>
              <span className="font-medium text-slate-900">
                {events.find((e) => e.id === parseInt(eventId))?.name || 'Event'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-slate-500">Date:</span>
              <span className="font-medium text-slate-900">
                {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
          </div>

          {/* Criteria & Weights */}
          <div className="mb-8 border-t border-b border-slate-200 py-4">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Criteria & Weights
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {report.criteria.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700 font-medium">{c.name}</span>
                  <span className="text-slate-500">
                    {(c.weight * 100).toFixed(0)}% (Range: {c.min_score}–{c.max_score})
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed Score Table */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Detailed Scores
            </h3>
            <table className="w-full text-sm border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 px-3 py-2 text-left font-semibold text-slate-700">#</th>
                  <th className="border border-slate-300 px-3 py-2 text-left font-semibold text-slate-700">Contestant</th>
                  {report.criteria.map((c) => (
                    <th key={c.id} className="border border-slate-300 px-3 py-2 text-center font-semibold text-slate-700">
                      {c.name}
                    </th>
                  ))}
                  <th className="border border-slate-300 px-3 py-2 text-center font-semibold text-slate-700">Total</th>
                </tr>
              </thead>
              <tbody>
                {report.rankings.map((r, idx) => {
                  const contestant = report.contestants.find((c) => c.id === r.contestant_id);
                  return (
                    <tr key={r.contestant_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="border border-slate-300 px-3 py-2 text-center font-mono text-sm">{r.contestant_number}</td>
                      <td className="border border-slate-300 px-3 py-2 font-medium">{r.contestant_name}</td>
                      {report.criteria.map((c) => {
                        const scores = report.scores.filter(
                          (s) => s.contestant_id === r.contestant_id && s.criteria_id === c.id
                        );
                        const avg = scores.length > 0
                          ? (scores.reduce((sum, s) => sum + s.score, 0) / scores.length).toFixed(2)
                          : '—';
                        return (
                          <td key={c.id} className="border border-slate-300 px-3 py-2 text-center">{avg}</td>
                        );
                      })}
                      <td className="border border-slate-300 px-3 py-2 text-center font-bold">{r.total_score.toFixed(3)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Final Rankings */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Award className="w-4 h-4" /> Final Rankings
            </h3>
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
                {report.rankings.map((r, idx) => (
                  <tr key={r.contestant_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="border border-slate-300 px-3 py-2 text-center font-bold text-lg">
                      {r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : `#${r.rank}`}
                    </td>
                    <td className="border border-slate-300 px-3 py-2 text-center">{r.contestant_number}</td>
                    <td className="border border-slate-300 px-3 py-2 font-medium">{r.contestant_name}</td>
                    <td className="border border-slate-300 px-3 py-2 text-right font-bold font-mono">
                      {r.total_score.toFixed(3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Judges List */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" /> Judges
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {report.judges.map((j) => (
                <div key={j.id} className="text-sm">
                  <span className="font-medium">{j.name}</span>
                  <span className="text-slate-400 ml-2">(Seat #{j.seat_number})</span>
                </div>
              ))}
            </div>
          </div>

          {/* Signature Lines */}
          <div className="mt-16 pt-8 border-t border-slate-300">
            <div className="grid grid-cols-3 gap-8">
              <div>
                <div className="border-b border-slate-400 pb-1 mb-1">&nbsp;</div>
                <p className="text-xs text-slate-500 text-center">Head Judge</p>
              </div>
              <div>
                <div className="border-b border-slate-400 pb-1 mb-1">&nbsp;</div>
                <p className="text-xs text-slate-500 text-center">Tabulator</p>
              </div>
              <div>
                <div className="border-b border-slate-400 pb-1 mb-1">&nbsp;</div>
                <p className="text-xs text-slate-500 text-center">Event Director</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
