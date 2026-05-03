import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';

export default function ConflictModal({
  localCount,
  serverCount,
  diffs = [],
  contestants = [],
  criteria = [],
  onKeepLocal,
  onDiscardLocal,
}) {
  const contestantName = (id) => {
    const c = contestants.find((c) => c.id === id);
    return c ? `#${c.number} ${c.name}` : `Contestant #${id}`;
  };

  const criterionName = (id) => {
    const c = criteria.find((c) => c.id === id);
    return c ? c.name : `Criterion #${id}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      <div 
        className="relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-200 bg-[var(--bg-primary)] border border-[var(--border-color)]"
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

          {diffs.length > 0 && (
            <div className="border border-[var(--border-color)] rounded-lg overflow-hidden">
              <div className="text-xs font-medium text-[var(--text-muted)] px-3 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border-color)]">
                {diffs.length} score{diffs.length > 1 ? 's' : ''} differ{diffs.length === 1 ? 's' : ''}
              </div>
              <div className="max-h-40 overflow-y-auto divide-y divide-[var(--border-color)]">
                {diffs.map((d, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-[var(--text-primary)] truncate">
                        {contestantName(d.contestantId)}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {criterionName(d.criteriaId)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <span className="text-[var(--color-warning)] font-medium">{d.localScore}</span>
                      <span className="text-[var(--text-muted)] text-xs">→</span>
                      <span className="text-[var(--text-primary)] font-medium">{d.serverScore}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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
