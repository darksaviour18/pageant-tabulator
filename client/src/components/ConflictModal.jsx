import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';

export default function ConflictModal({
  localCount,
  serverCount,
  onKeepLocal,
  onDiscardLocal,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      <div 
        className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-200 bg-[var(--bg-primary)] border border-[var(--border-color)]"
      >
        <div className="flex items-center gap-3 px-6 py-4 bg-[var(--bg-tertiary)] border-b border-[var(--border-color)]">
          <AlertTriangle className="w-5 h-5 text-[var(--color-warning)]" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            Score Conflict Detected
          </h3>
        </div>

        <div className="px-6 py-5 space-y-3">
          <p className="text-sm text-[var(--text-secondary)]">
            Your local scores differ from the server after reconnecting.
          </p>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-lg p-3 bg-[var(--bg-tertiary)]">
              <div className="text-2xl font-bold text-[var(--color-warning)]">
                {localCount}
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                Local scores
              </div>
            </div>
            <div className="rounded-lg p-3 bg-[var(--bg-secondary)]">
              <div className="text-2xl font-bold text-[var(--text-primary)]">
                {serverCount}
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                Server scores
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <button
            onClick={onDiscardLocal}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-[var(--hover-bg)] border border-[var(--border-color)]"
          >
            <ArrowDownToLine className="w-4 h-4" />
            Use Server Scores
          </button>
          <button
            onClick={onKeepLocal}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors bg-[var(--color-accent)] text-white hover:opacity-90"
          >
            <ArrowUpFromLine className="w-4 h-4" />
            Keep My Scores
          </button>
        </div>
      </div>
    </div>
  );
}