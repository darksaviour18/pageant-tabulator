import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table';
import ScoreCell from './ScoreCell';
import { useOfflineScores } from '../hooks/useOfflineScores';
import { useAutoSave } from '../hooks/useAutoSave';
import { ArrowLeft, Send, CheckCircle2, Loader2, AlertCircle, X, UserRound } from 'lucide-react';
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
  onScoreChange,
  onScoreSaved,
  isSubmitted: isSubmittedProp,
  isUnlocked: isUnlockedProp = false,
}) {
  const { onEvent } = useSocket();
  const { isDark } = useTheme();
  const [focusedCell, setFocusedCell] = useState({ row: 0, col: 0 });
  const [syncing, setSyncing] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedContestant, setSelectedContestant] = useState(null);
  const [contestantPhotos, setContestantPhotos] = useState({});
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const contestantPhotosRef = useRef({}); // always holds the latest photo map for cleanup

  // Auto-save: write to IndexedDB immediately, debounce POST to server
  // Must come BEFORE useOfflineScores because refetchKey is used below
  const { saveAndSync, syncNow, getPendingCount, isSyncing, clearSyncStatus, conflict, resolveConflict, refetchKey } = useAutoSave({
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

  // Read-only if: submitted AND NOT unlocked, OR category is locked by admin
  const isSubmittedVal = isSubmittedProp !== undefined ? isSubmittedProp : isSubmitted;
  const isReadOnly = (isSubmittedVal && !isUnlockedProp) || category.is_locked;
  const criteria = category.criteria || [];

  // Reset sync status when category becomes unlocked (e.g., after admin unlock)
  // This prevents stuck syncing state after category transitions from submitted/locked to editable
  const prevIsReadOnlyRef = useRef(isReadOnly);
  useEffect(() => {
    if (prevIsReadOnlyRef.current && !isReadOnly) {
      // Transitioned from read-only to editable - clear stuck sync status
      clearSyncStatus();
    }
    prevIsReadOnlyRef.current = isReadOnly;
  }, [isReadOnly, clearSyncStatus]);

  // Handle score change: save locally + queue for server sync
  const handleScoreChange = useCallback(
    (contestantId, criteriaId, score) => {
      const prevScore = getScore(contestantId, criteriaId);
      const hasScoreNow = score !== null && score !== '';
      const hadScoreBefore = prevScore !== null && prevScore !== '';
      
      saveAndSync(contestantId, criteriaId, score);
      
      // Update allScores in parent for real-time progress updates
      if (onScoreSaved) {
        onScoreSaved(contestantId, criteriaId, category.id, score);
      }
      
      // Notify parent to update progress bar in real-time
      if (onScoreChange) {
        if (!hadScoreBefore && hasScoreNow) {
          onScoreChange(true); // New score added
        } else if (hadScoreBefore && !hasScoreNow) {
          onScoreChange(false); // Score was cleared
        }
      }
    },
    [saveAndSync, getScore, onScoreChange, onScoreSaved, category]
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

  // Load contestant photos
  useEffect(() => {
    if (!eventId || !contestants?.length) return;
    
    const loadPhotos = async () => {
      setLoadingPhotos(true);
      const photos = {};
      for (const c of contestants) {
        try {
          const res = await fetch(`/api/events/${eventId}/contestants/${c.id}/photo`);
          if (res.ok) {
            const blob = await res.blob();
            photos[c.id] = URL.createObjectURL(blob);
          }
        } catch {
          // No photo
        }
      }
      // Update both state (for rendering) and ref (for cleanup)
      contestantPhotosRef.current = photos;
      setContestantPhotos(photos);
      setLoadingPhotos(false);
    };
    
    loadPhotos();
    return () => {
      // Revoke using the ref — always reflects the latest loaded photos, not a stale closure
      Object.values(contestantPhotosRef.current).forEach(url => URL.revokeObjectURL(url));
      contestantPhotosRef.current = {};
    };
  }, [eventId, contestants]);

  const handleContestantClick = (contestant) => {
    setSelectedContestant(contestant);
  };

  // Build table columns
  const columns = useMemo(() => {
    const cols = [
      {
        id: 'contestant',
        header: 'Contestant',
        size: 200,
        sticky: 'left',
        cell: ({ row }) => {
          const c = row.original;
          const photoUrl = contestantPhotos[c.id];
          return (
            <div 
              className="flex items-center gap-3 px-3 py-2 min-h-[56px] cursor-pointer hover:bg-[var(--color-bg-subtle)] rounded-lg transition cursor-zoom-in"
              onClick={() => handleContestantClick(c)}
            >
              <span className="w-8 text-center text-sm font-bold text-[var(--color-text)]">{c.number}</span>
              {photoUrl ? (
                <img 
                  src={photoUrl} 
                  alt={c.name}
                  className="w-10 h-10 rounded-full object-cover border-2 border-[var(--color-border)]"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[var(--color-bg-subtle)] border-2 border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)]">
                  <UserRound className="w-5 h-5" />
                </div>
              )}
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
          const syncing = isSyncing(contestant.id, crit.id);
          const unsaved = isUnsaved(contestant.id, crit.id);
          const saved = value !== null && !unsaved && !syncing;

          return (
            <ScoreCell
              value={value}
              minScore={crit.min_score}
              maxScore={crit.max_score}
              isSaved={saved}
              isSyncing={syncing}
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
              {isSubmitted && isUnlockedProp ? 'Submitted (Unlocked - You can edit)' : isSubmitted ? 'Submitted' : 'Locked by Admin'}
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
                      className={`px-2 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider ${header.column.columnDef.sticky === 'left' ? 'sticky left-0 z-10 bg-[var(--color-bg)]' : ''}`}
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
                    <td key={cell.id} className={cell.column.columnDef.sticky === 'left' ? 'sticky left-0 z-10 bg-[var(--color-bg-subtle)] border-r border-[var(--color-border)]' : ''}>
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

      {/* Full-screen Photo Preview Modal */}
      {selectedContestant && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setSelectedContestant(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors"
            onClick={() => setSelectedContestant(null)}
          >
            <X className="w-6 h-6" />
          </button>
          <div className="text-center" onClick={(e) => e.stopPropagation()}>
            <img 
              src={contestantPhotos[selectedContestant.id]}
              alt={selectedContestant.name}
              className="max-h-[70vh] max-w-[90vw] rounded-lg object-contain"
            />
            <p className="text-white text-lg font-medium mt-4">
              #{selectedContestant.number} — {selectedContestant.name}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
