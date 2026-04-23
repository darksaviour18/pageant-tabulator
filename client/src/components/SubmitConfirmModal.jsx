import { AlertTriangle, X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function SubmitConfirmModal({ categoryName, onConfirm, onCancel }) {
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
        <div className={`flex items-center justify-between px-6 py-4 ${
          isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-red-50 border-b border-red-100'
        }`}>
          <div className="flex items-center gap-3">
            <AlertTriangle className={`w-5 h-5 ${isDark ? 'text-pink-400' : 'text-red-500'}`} />
            <h3 className={`text-lg font-semibold ${isDark ? 'text-zinc-100' : 'text-red-700'}`}>
              Confirm Submission
            </h3>
          </div>
          <button
            onClick={onCancel}
            className={`transition-colors ${isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className={isDark ? 'text-zinc-300' : 'text-slate-700'}>
            You are about to submit scores for{' '}
            <span className={`font-semibold ${isDark ? 'text-zinc-100' : 'text-slate-900'}`}>
              {categoryName}
            </span>.
          </p>
          <p className={`mt-2 text-sm font-medium ${isDark ? 'text-pink-400' : 'text-red-600'}`}>
            ⚠ You will not be able to edit these scores after submission unless the admin unlocks them.
          </p>
        </div>

        {/* Footer */}
        <div className={`flex gap-3 px-6 py-4 border-t ${
          isDark 
            ? 'bg-zinc-800/50 border-zinc-700' 
            : 'bg-slate-50 border-slate-200'
        }`}>
          <button
            onClick={onCancel}
            className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              isDark
                ? 'bg-zinc-700 text-zinc-200 hover:bg-zinc-600 border border-zinc-600'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              isDark
                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:from-pink-600 hover:to-rose-600'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            Submit Scores
          </button>
        </div>
      </div>
    </div>
  );
}