import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';

/**
 * Conflict resolution modal shown when local scores differ from server
 * after a reconnect event.
 */
export default function ConflictModal({
  localCount,
  serverCount,
  onKeepLocal,
  onDiscardLocal,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 bg-amber-50 border-b border-amber-100">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <h3 className="text-lg font-semibold text-amber-800">Score Conflict Detected</h3>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-3">
          <p className="text-slate-700 text-sm">
            Your local scores differ from the server after reconnecting.
          </p>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-amber-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-amber-700">{localCount}</div>
              <div className="text-xs text-amber-600">Local scores</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-slate-700">{serverCount}</div>
              <div className="text-xs text-slate-500">Server scores</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 bg-slate-50 border-t border-slate-200">
          <button
            onClick={onDiscardLocal}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <ArrowDownToLine className="w-4 h-4" />
            Use Server Scores
          </button>
          <button
            onClick={onKeepLocal}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors"
          >
            <ArrowUpFromLine className="w-4 h-4" />
            Keep My Scores
          </button>
        </div>
      </div>
    </div>
  );
}
