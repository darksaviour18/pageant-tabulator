import { useState, useEffect } from 'react';
import { eventsAPI, categoriesAPI } from '../api';
import { reportsAPI, eliminationRoundsAPI } from '../api';
import { Crown, Printer, Loader2, Calendar, Users, Award, ChevronLeft, ChevronRight, Save, Trash2, RotateCcw, Download } from 'lucide-react';
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
  const [reportTitle, setReportTitle] = useState('');
  const [signatureType, setSignatureType] = useState('judges'); // 'judges' | 'tabulators'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [savedReports, setSavedReports] = useState([]);

  useEffect(() => {
    eventsAPI.getAll().then((res) => setEvents(res.data || [])).catch(console.error);
  }, []);

  // Load saved reports when event changes
  useEffect(() => {
    if (eventId) {
      reportsAPI.getSavedReports(eventId)
        .then((res) => setSavedReports(res.data || []))
        .catch(console.error);
    } else {
      setSavedReports([]);
    }
  }, [eventId]);

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
    setReportTitle('');
    setError(null);
  };

  const handleGenerate = async (configFromSaved = null) => {
    setError(null);
    setLoading(true);

    // Use provided config or current state
    const config = configFromSaved || {
      reportType,
      selectedCategoryId,
      selectedCategoryIds,
      reportTitle,
    };

    try {
      let res;
      if (config.reportType === 'category_detail') {
        const catId = config.selectedCategoryId;
        if (!eventId || !catId) {
          setError('Please select a category');
          setLoading(false);
          return;
        }
        res = await reportsAPI.getReport(parseInt(eventId, 10), parseInt(catId, 10));
      } else {
        const catIds = config.selectedCategoryIds;
        if (!eventId || catIds.length === 0) {
          setError('Please select at least one category');
          setLoading(false);
          return;
        }
        res = await reportsAPI.getCrossCategoryReport(parseInt(eventId, 10), {
          category_ids: catIds,
          report_title: config.reportTitle || 'OVERALL PRELIMINARY SCORES',
        });
      }
      setReport(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveReport = async () => {
    if (!eventId || !report) return;

    const config = {
      reportType,
      category_id: reportType === 'category_detail' ? parseInt(selectedCategoryId, 10) : null,
      category_ids: reportType === 'cross_category' ? selectedCategoryIds : [],
      reportTitle,
      signatureType,
    };

    try {
      await reportsAPI.saveReport({
        event_id: parseInt(eventId, 10),
        report_type: reportType,
        report_title: reportTitle || (reportType === 'category_detail' ? `Category: ${report.category?.name}` : report.title || 'Cross-Category Report'),
        configuration: config,
      });

      // Refresh saved reports
      const res = await reportsAPI.getSavedReports(eventId);
      setSavedReports(res.data || []);
    } catch (err) {
      console.error('Failed to save report:', err);
    }
  };

  const handleLoadSavedReport = async (saved) => {
    const config = JSON.parse(saved.configuration);

    setReportType(config.reportType);
    setSelectedCategoryId(config.category_id ? String(config.category_id) : '');
    setSelectedCategoryIds(config.category_ids || []);
    setReportTitle(config.reportTitle || '');
    setSignatureType(config.signatureType || 'judges');

    // Auto-generate
    await handleGenerate(config);
  };

  const handleDeleteSavedReport = async (id, e) => {
    e.stopPropagation();
    try {
      await reportsAPI.deleteSavedReport(id);
      setSavedReports((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error('Failed to delete saved report:', err);
    }
  };

  const handleRegenerateReport = async (saved, e) => {
    e.stopPropagation();
    const config = JSON.parse(saved.configuration);
    await handleGenerate(config);
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

  const handleExportCsv = async () => {
    if (!selectedCategoryId || reportType !== 'category_detail') return;
    try {
      const res = await reportsAPI.getCsv(parseInt(eventId, 10), parseInt(selectedCategoryId, 10));
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report?.category?.name || 'report'}_${eventId}.csv`.replace(/[^a-z0-9_]/gi, '_');
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export CSV:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls - hidden when printing */}
      <div className="no-print space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-[var(--color-text)]">Reports & Printing</h2>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          {/* Report Type Selector */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Report Type</label>
            <select
              value={reportType}
              onChange={handleReportTypeChange}
              className="px-4 py-2.5 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-cta)] focus:border-[var(--color-cta)] outline-none bg-[var(--color-bg-subtle)] text-[var(--color-text)] min-w-[250px]"
            >
              {REPORT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Event</label>
            <select
              value={eventId}
              onChange={handleEventChange}
              className="px-4 py-2.5 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-cta)] focus:border-[var(--color-cta)] outline-none bg-[var(--color-bg-subtle)] text-[var(--color-text)] min-w-[200px]"
            >
              <option value="">Select event...</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>

          {reportType === 'category_detail' && (
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Category</label>
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                disabled={!eventId}
                className="px-4 py-2.5 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-cta)] focus:border-[var(--color-cta)] outline-none bg-[var(--color-bg-subtle)] text-[var(--color-text)] min-w-[200px] disabled:opacity-50"
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
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-[var(--color-text)]">Categories</label>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryIds(categories.map(c => c.id))}
                    className="text-[var(--color-primary)] hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-[var(--color-text-muted)]">·</span>
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryIds([])}
                    className="text-[var(--color-primary)] hover:underline"
                  >
                    Clear All
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-2 p-3 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-subtle)] min-h-[80px] max-h-[200px] overflow-y-auto">
                {categories.length === 0 && (
                  <span className="text-sm text-[var(--color-text-muted)]">Select an event first</span>
                )}
                {categories.map((c) => {
                  const checked = selectedCategoryIds.includes(c.id);
                  return (
                    <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
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
                        className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                      />
                      <span className="text-[var(--color-text)]">{c.name}</span>
                    </label>
                  );
                })}
              </div>
              {selectedCategoryIds.length > 0 && (
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  {selectedCategoryIds.length} of {categories.length} categories selected
                </p>
              )}
            </div>
          )}

          {rounds.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Filter by Round</label>
              <select
                value={selectedRoundId}
                onChange={(e) => setSelectedRoundId(e.target.value)}
                className="px-4 py-2.5 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-cta)] focus:border-[var(--color-cta)] outline-none bg-[var(--color-bg-subtle)] text-[var(--color-text)] min-w-[200px]"
              >
                <option value="">All contestants</option>
                {rounds.map((r) => (
                  <option key={r.id} value={r.id}>{r.round_name} ({r.contestant_count})</option>
                ))}
              </select>
            </div>
          )}

          {/* Report Title */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Report Title (optional)</label>
            <input
              type="text"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              placeholder="Default title will be used"
              className="px-3 py-2.5 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-cta)] focus:border-[var(--color-cta)] outline-none bg-[var(--color-bg-subtle)] text-[var(--color-text)] min-w-[250px]"
            />
          </div>

          {/* Signature Type */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Signatures</label>
            <select
              value={signatureType}
              onChange={(e) => setSignatureType(e.target.value)}
              className="px-4 py-2.5 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-cta)] focus:border-[var(--color-cta)] outline-none bg-[var(--color-bg-subtle)] text-[var(--color-text)] min-w-[180px]"
            >
              <option value="judges">Judges' Signatures</option>
              <option value="tabulators">Tabulators</option>
            </select>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || !eventId || (reportType === 'category_detail' && !selectedCategoryId) || (reportType === 'cross_category' && selectedCategoryIds.length === 0)}
            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-cta)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all active:scale-95"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
            Generate Report
          </button>

          {report && (
            <>
              <button
                onClick={handleSaveReport}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors"
              >
                <Save className="w-4 h-4" />
                Save Report
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-lg transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              {reportType === 'category_detail' && selectedCategoryId && (
                <button
                  onClick={handleExportCsv}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  CSV
                </button>
              )}
            </>
          )}

          {/* Sidebar Toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg transition-colors ${
              sidebarOpen ? 'bg-[var(--color-warning)]/10 border-[var(--color-warning)]/30 text-[var(--color-warning)]' : 'bg-[var(--bg-primary)] border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
            }`}
          >
            {sidebarOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            {sidebarOpen ? 'Hide' : 'Show'} History
          </button>
        </div>

        {error && (
          <div className="text-sm text-red-500 bg-red-500/10 px-4 py-3 rounded-lg">{error}</div>
        )}
      </div>

      {/* Report History Sidebar */}
      <div className={`no-print transition-all duration-300 ease-in-out ${sidebarOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
        <div className="bg-[var(--color-bg-subtle)] border border-[var(--color-border)] rounded-lg p-4">
          <h3 className="text-sm font-semibold text-[var(--color-text)] mb-3">Saved Reports</h3>
          {savedReports.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] italic">No saved reports yet. Generate and save a report to see it here.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {savedReports.map((saved) => (
                <div
                  key={saved.id}
                  onClick={() => handleLoadSavedReport(saved)}
                  className="flex items-center justify-between p-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg hover:border-[var(--color-cta)] hover:bg-[var(--color-cta)]/10 cursor-pointer transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text)] truncate">{saved.report_title}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{saved.report_type === 'category_detail' ? 'Category Detail' : 'Cross-Category'} • {new Date(saved.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={(e) => handleRegenerateReport(saved, e)}
                      title="Regenerate"
                      className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-100 rounded transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteSavedReport(saved.id, e)}
                      title="Delete"
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-100 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Report Content */}
      {(report || loading) && (
        <div id="print-report" className="print-report bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)] mb-4" />
              <p className="text-lg font-medium text-slate-700">Generating Report...</p>
              <p className="text-sm text-slate-500 mt-1">Calculating scores and rankings</p>
            </div>
          ) : (
            reportType === 'category_detail' ? (
              <CategoryDetailReport report={report} event={events.find((e) => e.id === parseInt(eventId))} signatureType={signatureType} customTitle={reportTitle} />
            ) : (
              <CrossCategoryReport report={report} event={events.find((e) => e.id === parseInt(eventId))} signatureType={signatureType} customTitle={reportTitle} />
            )
          )}
        </div>
      )}

      {/* Elimination Rounds — shown for all report types */}
      {report && eventId && (
        <EliminationRoundManager
          eventId={parseInt(eventId, 10)}
          reportData={
            reportType === 'cross_category'
              ? report
              : { contestants: report.ranked_contestants }
          }
          categories={categories}
          onRoundCreated={handleRoundCreated}
        />
      )}
    </div>
  );
}

/**
 * Category Detail Report (existing per-category report)
 */
function CategoryDetailReport({ report, event, signatureType, customTitle }) {
  return (
    <>
      <div className="text-center mb-8 border-b-2 border-slate-900 pb-6">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">PAGEANT TABULATOR PRO</h1>
        <h2 className="text-xl font-semibold text-slate-700 mt-2">{customTitle || `OFFICIAL SCORE SHEET — ${report.category.name.toUpperCase()}`}</h2>
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
        {signatureType === 'judges' ? (
          <div>
            <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Judges' Signatures</h4>
            <div className="grid grid-cols-3 gap-8">
              {report.judges.map((j) => (
                <div key={j.id}><div className="border-b border-slate-400 pb-1 mb-1">&nbsp;</div><p className="text-xs text-slate-500 text-center">{j.name} (Seat #{j.seat_number})</p></div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Tabulators</h4>
            <div className="grid grid-cols-2 gap-8">
              {(event?.tabulators ? JSON.parse(event.tabulators) : [])
                .filter(t => t.name)
                .map((t) => (
                  <div key={t.name}><div className="border-b border-slate-400 pb-1 mb-1">&nbsp;</div><p className="text-xs text-slate-500 text-center">{t.name}</p></div>
                ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/**
 * Cross-Category Consolidation Report
 */
function CrossCategoryReport({ report, event, signatureType, customTitle }) {
  return (
    <>
      <div className="text-center mb-8 border-b-2 border-slate-900 pb-6">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">PAGEANT TABULATOR PRO</h1>
        <h2 className="text-xl font-semibold text-slate-700 mt-2">{customTitle || report.title}</h2>
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
            <span key={c.id} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-700">
              {c.name} {c.weight && c.weight !== 1 ? `(${c.weight}x)` : ''}
            </span>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-2">Note: Scores are weighted by category weight. Higher total = better placement.</p>
      </div>

      {report?.filtered_by_rounds?.length > 0 && (
        <div className="no-print text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg mt-2 mb-4">
          ℹ This report shows {report.eligible_count} of {report.total_active_count} active contestants.
          {report.total_active_count - report.eligible_count} contestants were excluded because they did not
          qualify in all selected categories.
        </div>
      )}

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
              <th className="border border-slate-600 px-3 py-2 text-center font-semibold">Weighted Score</th>
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
                    {c.category_scores[cat.id] !== undefined ? c.category_scores[cat.id].toFixed(2) : '—'}
                  </td>
                ))}
                <td className="border border-slate-300 px-3 py-2 text-center font-bold">{c.weighted_total.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-16 pt-8 border-t border-slate-300">
        {signatureType === 'judges' ? (
          <div>
            <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Judges' Signatures</h4>
            <div className="grid grid-cols-3 gap-8">
              {report.categories && (
                <div className="col-span-3 text-sm text-slate-500 italic">Judges sign above their respective category sheets</div>
              )}
            </div>
          </div>
        ) : (
          <div>
            <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Tabulators</h4>
            <div className="grid grid-cols-2 gap-8">
              {(event?.tabulators ? JSON.parse(event.tabulators) : [])
                .filter(t => t.name)
                .map((t) => (
                  <div key={t.name}><div className="border-b border-slate-400 pb-1 mb-1">&nbsp;</div><p className="text-xs text-slate-500 text-center">{t.name}</p></div>
                ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
