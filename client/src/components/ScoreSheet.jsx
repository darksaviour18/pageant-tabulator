import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table';
import ScoreCell from './ScoreCell';
import { useOfflineScores } from '../hooks/useOfflineScores';
import { useAutoSave } from '../hooks/useAutoSave';
import { ArrowLeft, Send, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import SubmitConfirmModal from './SubmitConfirmModal';
import ConflictModal from './ConflictModal';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';

export default function ScoreSheet({
  judgeId,
  eventId,
  category,
  contestants,
  serverScores = [],
  onBack,
  onSubmit,
  onContestantsChange,
}) {
  const { onEvent } = useSocket();
  const { isDark } = useTheme();
  const [focusedCell, setFocusedCell] = useState({ row: 0, col: 0 });
  const [syncing, setSyncing] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Auto-save: write to IndexedDB immediately, debounce POST to server
  // Must come BEFORE useOfflineScores because refetchKey is used below
  const { saveAndSync, syncNow, getPendingCount, conflict, resolveConflict, refetchKey } = useAutoSave({
    judgeId,
    eventId,
    categoryId: category.id,
  });

  // Offline-first: read from IndexedDB — re-fetch when refetchKey changes
  const { getScore, isUnsaved, isSubmitted, loading: dbLoading } = useOfflineScores(
    judgeId,
    category.id,
    { serverScores, refetchKey }
  );

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
  const handleInitiateSubmit = useCallback(() => {
    setShowSubmitModal(true);
  }, []);

  const handleConfirmSubmit = useCallback(async () => {
    setShowSubmitModal(false);
    if (getPendingCount() > 0) {
      setSubmitting(true);
      await syncNow();
      setSubmitting(false);
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
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[var(--color-bg-subtle)] text-sm font-bold text-[var(--color-text)]">
                {c.number}
              </span>
              <span className="text-sm font-medium text-[var(--color-text)]">{c.name}</span>
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
            <div className="text-xs font-semibold text-[var(--color-text)]">{crit.name}</div>
            <div className="text-[10px] text-[var(--color-text-muted)]">
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
              isReadOnly={effectiveReadOnly}
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

  // 10.3.8: Listen for contestant_added event — notify parent to refetch
  useEffect(() => {
    const unsub = onEvent('contestant_added', () => {
      onContestantsChange?.();
    });
    return unsub;
  }, [onEvent, onContestantsChange]);

  // 10.2.7: Listen for category_locked event — force re-read of isReadOnly
  const [categoryLocked, setCategoryLocked] = useState(false);
  useEffect(() => {
    const unsub = onEvent('category_locked', (data) => {
      if (data.categoryId === category.id) {
        setCategoryLocked(data.isLocked);
      }
    });
    return unsub;
  }, [onEvent, category.id]);

  const effectiveReadOnly = isReadOnly || categoryLocked;

  if (dbLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-[var(--color-text-muted)] text-lg">Loading scores...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-cta)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Categories
        </button>
        <div className="flex items-center gap-3">
          {getPendingCount() > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-[var(--color-cta)]">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Saving {getPendingCount()}...
            </span>
          )}
          {effectiveReadOnly && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]">
              {isSubmitted ? 'Submitted' : 'Locked by Admin'}
            </span>
          )}
          <button
            onClick={handleInitiateSubmit}
            disabled={!allFilled || effectiveReadOnly}
            className="flex items-center gap-2 px-5 py-2 bg-[var(--color-cta)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all active:scale-95"
          >
            {submitting ? (
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
      <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-green-500/10 border-2 border-green-500/30 inline-block" /> Saved
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-amber-500/10 border-2 border-amber-500/30 inline-block" /> Unsaved
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-[var(--color-bg-subtle)] border-2 border-[var(--color-border)] inline-block" /> Empty
        </span>
        <span className="ml-2 text-[var(--color-text-muted)]">
          Use Tab/Arrow keys to navigate · Enter to move down · Auto-saves after 250ms
        </span>
      </div>

      {/* Read-Only Banner */}
      {effectiveReadOnly && (
        <div className="bg-[var(--color-bg-subtle)] border border-[var(--color-border)] rounded-lg px-4 py-3 flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0" />
          <span className="text-sm text-[var(--color-text)] font-medium">
            This category has been {isSubmitted ? 'submitted and locked' : 'locked by admin'}. You cannot edit scores.
          </span>
        </div>
      )}

      {/* Spreadsheet Table */}
      <div className="bg-[var(--color-bg-subtle)] rounded-xl shadow-sm border border-[var(--color-border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="bg-[var(--color-bg)] border-b border-[var(--color-border)]">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-2 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider"
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
                  className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg)] transition-colors"
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

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <SubmitConfirmModal
          categoryName={category.name}
          onConfirm={handleConfirmSubmit}
          onCancel={() => setShowSubmitModal(false)}
        />
      )}

      {/* Conflict Resolution Modal */}
      {conflict && (
        <ConflictModal
          localCount={conflict.localCount}
          serverCount={conflict.serverCount}
          onKeepLocal={() => resolveConflict('keep-local')}
          onDiscardLocal={() => resolveConflict('discard-local')}
        />
      )}
    </div>
  );
}
