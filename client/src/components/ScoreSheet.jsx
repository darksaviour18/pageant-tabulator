import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table';
import ScoreCell from './ScoreCell';
import { useOfflineScores } from '../hooks/useOfflineScores';
import { useAutoSave } from '../hooks/useAutoSave';
import { ArrowLeft, Send, CheckCircle2, Loader2 } from 'lucide-react';

export default function ScoreSheet({
  judgeId,
  eventId,
  category,
  contestants,
  serverScores = [],
  onBack,
  onSubmit,
}) {
  const [focusedCell, setFocusedCell] = useState({ row: 0, col: 0 });
  const [syncing, setSyncing] = useState(false);

  // Offline-first: read from IndexedDB
  const { getScore, isUnsaved, isSubmitted, loading: dbLoading } = useOfflineScores(
    judgeId,
    category.id,
    { serverScores }
  );

  // Auto-save: write to IndexedDB immediately, debounce POST to server
  const { saveAndSync, syncNow, getPendingCount } = useAutoSave({
    judgeId,
    categoryId: category.id,
  });

  const isReadOnly = isSubmitted || category.is_locked;
  const criteria = category.criteria || [];

  // Handle score change: save locally + queue for server sync
  const handleScoreChange = useCallback(
    (contestantId, criteriaId, score) => {
      saveAndSync(contestantId, criteriaId, score);
    },
    [saveAndSync]
  );

  // Force flush remaining scores on category submit
  const handleSubmit = useCallback(async () => {
    if (getPendingCount() > 0) {
      setSyncing(true);
      await syncNow();
      setSyncing(false);
    }
    onSubmit();
  }, [getPendingCount, syncNow, onSubmit]);

  // Build table columns
  const columns = useMemo(() => {
    const cols = [
      {
        id: 'contestant',
        header: 'Contestant',
        size: 180,
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="flex items-center gap-3 px-3 py-2">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-sm font-bold text-slate-700">
                {c.number}
              </span>
              <span className="text-sm font-medium text-slate-900">{c.name}</span>
            </div>
          );
        },
      },
    ];

    criteria.forEach((crit, idx) => {
      cols.push({
        id: `criteria_${crit.id}`,
        header: () => (
          <div className="text-center">
            <div className="text-xs font-semibold text-slate-700">{crit.name}</div>
            <div className="text-[10px] text-slate-400">
              {(crit.weight * 100).toFixed(0)}% ({crit.min_score}–{crit.max_score})
            </div>
          </div>
        ),
        size: 140,
        cell: ({ row }) => {
          const contestant = row.original;
          const value = getScore(contestant.id, crit.id);
          const unsaved = isUnsaved(contestant.id, crit.id);
          const saved = value !== null && !unsaved;

          return (
            <ScoreCell
              value={value}
              minScore={crit.min_score}
              maxScore={crit.max_score}
              isSaved={saved}
              isUnsaved={unsaved}
              isReadOnly={isReadOnly}
              onChange={(score) => handleScoreChange(contestant.id, crit.id, score)}
              rowIndex={row.index}
              colIndex={idx}
              totalRows={contestants.length}
              totalCols={criteria.length}
              onFocusCell={(r, c) => setFocusedCell({ row: r, col: c })}
            />
          );
        },
      });
    });

    return cols;
  }, [criteria, contestants, getScore, isUnsaved, isReadOnly, handleScoreChange]);

  const data = useMemo(() => contestants, [contestants]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // Check if all cells are filled
  const allFilled = useMemo(() => {
    return contestants.every((c) =>
      criteria.every((crit) => {
        const val = getScore(c.id, crit.id);
        return val !== null && val !== undefined;
      })
    );
  }, [contestants, criteria, getScore]);

  if (dbLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-slate-500 text-lg">Loading scores...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-amber-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Categories
        </button>
        <div className="flex items-center gap-3">
          {getPendingCount() > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-amber-600">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Saving {getPendingCount()}...
            </span>
          )}
          {isReadOnly && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
              {isSubmitted ? 'Submitted' : 'Locked by Admin'}
            </span>
          )}
          <button
            onClick={handleSubmit}
            disabled={!allFilled || isReadOnly || syncing}
            className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {syncing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Submit Category
              </>
            )}
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-green-50 border-2 border-green-300 inline-block" /> Saved
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-amber-50 border-2 border-amber-400 inline-block" /> Unsaved
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-white border-2 border-slate-200 inline-block" /> Empty
        </span>
        <span className="ml-2 text-slate-400">
          Use Tab/Arrow keys to navigate · Enter to move down · Auto-saves after 250ms
        </span>
      </div>

      {/* Spreadsheet Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="bg-slate-50 border-b border-slate-200">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-2 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider"
                      style={{ width: header.getSize() }}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  data-row={row.index}
                  className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
