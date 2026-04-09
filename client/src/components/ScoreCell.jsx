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
  isUnsaved,
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
    <td className="p-1">
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
          className={`w-full px-2 py-1.5 text-center text-sm rounded-md border-2 outline-none transition-all
            ${isReadOnly ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : ''}
            ${isError ? 'border-red-400 bg-red-50' : ''}
            ${isUnsaved && !isError ? 'border-amber-400 bg-amber-50' : ''}
            ${isSaved && !isUnsaved ? 'border-green-300 bg-green-50' : ''}
            ${!isSaved && !isUnsaved && !isError ? 'border-slate-200 bg-white focus:border-amber-400' : ''}
          `}
          min={minScore}
          max={maxScore}
          aria-label={`Score for contestant row ${rowIndex + 1}`}
        />
        {/* Status icon */}
        {!isReadOnly && !isError && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2">
            {isSaved && !isUnsaved && (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            )}
            {isUnsaved && (
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
    </td>
  );
}
