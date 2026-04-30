import { useState, useRef, useCallback, useMemo } from 'react';
import { CheckCircle2, CircleDashed, AlertCircle } from 'lucide-react';

/**
 * Individual score cell with validation and keyboard navigation.
 */
export default function ScoreCell({
  value,
  minScore = 0,
  maxScore = 10,
  isSaved,
  isSyncing,
  isReadOnly,
  onChange,
  rowIndex,
  colIndex,
  totalRows,
  totalCols,
  onFocusCell,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const inputRef = useRef(null);

  const isValid = draft === '' || (draft >= minScore && draft <= maxScore);
  const isError = draft !== '' && !isValid;

  const handleFocus = useCallback(() => {
    setEditing(true);
    setDraft(value ?? '');
  }, [value]);

  const handleBlur = useCallback(() => {
    setEditing(false);
    // Save on blur if changed and valid
    const num = parseFloat(draft);
    if (!isNaN(num) && isValid && num !== value) {
      onChange(num);
    }
  }, [draft, value, isValid, onChange]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        // Move down
        if (rowIndex < totalRows - 1) {
          onFocusCell(rowIndex + 1, colIndex);
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const nextCol = e.shiftKey ? colIndex - 1 : colIndex + 1;
        if (nextCol >= 0 && nextCol < totalCols) {
          onFocusCell(rowIndex, nextCol);
        } else if (nextCol >= totalCols && rowIndex < totalRows - 1) {
          onFocusCell(rowIndex + 1, 0);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (rowIndex < totalRows - 1) onFocusCell(rowIndex + 1, colIndex);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (rowIndex > 0) onFocusCell(rowIndex - 1, colIndex);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (colIndex > 0) onFocusCell(rowIndex, colIndex - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (colIndex < totalCols - 1) onFocusCell(rowIndex, colIndex + 1);
      } else if (e.key === 'Escape') {
        setEditing(false);
        setDraft(value ?? '');
      }
    },
    [rowIndex, colIndex, totalRows, totalCols, onFocusCell, value]
  );

  return (
    <div className="p-1">
      <div className="relative">
        <input
          ref={inputRef}
          type="number"
          step="0.1"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={isReadOnly}
          className={`w-full px-2 py-3 text-center text-sm rounded-md border-2 outline-none transition-all min-h-[56px]
            ${isReadOnly ? 'bg-[var(--color-bg-subtle)] border-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed' : ''}
            ${isError ? 'border-red-500 bg-red-500/10 animate-pulse' : ''}
            ${isSyncing && !isError ? 'border-[var(--color-cta)] bg-[var(--color-cta)]/10 animate-pulse' : ''}
            ${isSaved && !isSyncing ? 'border-green-500/30 bg-green-500/10' : ''}
            ${!isSaved && !isSyncing && !isError ? 'border-[var(--color-border)] bg-[var(--color-bg-subtle)] focus:border-[var(--color-cta)]' : ''}
          `}
          min={minScore}
          max={maxScore}
          aria-label={`Score for contestant row ${rowIndex + 1}`}
        />
        {/* Status icon */}
        {!isReadOnly && !isError && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2">
            {isSaved && !isSyncing && (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            )}
            {isSyncing && (
              <CircleDashed className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
            )}
          </div>
        )}
        {isError && !isReadOnly && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2">
            <AlertCircle className="w-3.5 h-3.5 text-red-500" />
          </div>
        )}
      </div>
    </div>
  );
}
