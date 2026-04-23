import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ConflictModal({
  localCount,
  serverCount,
  onKeepLocal,
  onDiscardLocal,
}) {
  const { isDark } = useTheme();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop with blur */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      {/* Modal Content */}
      <div 
        className={`relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-200 ${
          isDark ? 'bg-zinc-900 border border-zinc-700' : 'bg-white border border-slate-200'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center gap-3 px-6 py-4 ${
          isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-amber-50 border-b border-amber-100'
        }`}>
          <AlertTriangle className={`w-5 h-5 ${isDark ? 'text-pink-400' : 'text-amber-600'}`} />
          <h3 className={`text-lg font-semibold ${isDark ? 'text-zinc-100' : 'text-amber-800'}`}>
            Score Conflict Detected
          </h3>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-3">
          <p className={`text-sm ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
            Your local scores differ from the server after reconnecting.
          </p>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className={`rounded-lg p-3 ${isDark ? 'bg-zinc-800' : 'bg-amber-50'}`}>
              <div className={`text-2xl font-bold ${isDark ? 'text-pink-400' : 'text-amber-700'}`}>
                {localCount}
              </div>
              <div className={`text-xs ${isDark ? 'text-zinc-400' : 'text-amber-600'}`}>
                Local scores
              </div>
            </div>
            <div className={`rounded-lg p-3 ${isDark ? 'bg-zinc-800' : 'bg-slate-50'}`}>
              <div className={`text-2xl font-bold ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                {serverCount}
              </div>
              <div className={`text-xs ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>
                Server scores
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`flex gap-3 px-6 py-4 border-t ${
          isDark 
            ? 'bg-zinc-800/50 border-zinc-700' 
            : 'bg-slate-50 border-slate-200'
        }`}>
          <button
            onClick={onDiscardLocal}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              isDark
                ? 'bg-zinc-700 text-zinc-200 hover:bg-zinc-600 border border-zinc-600'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300'
            }`}
          >
            <ArrowDownToLine className="w-4 h-4" />
            Use Server Scores
          </button>
          <button
            onClick={onKeepLocal}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              isDark
                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:from-pink-600 hover:to-rose-600'
                : 'bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700'
            }`}
          >
            <ArrowUpFromLine className="w-4 h-4" />
            Keep My Scores
          </button>
        </div>
      </div>
    </div>
  );
}