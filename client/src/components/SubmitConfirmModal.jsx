import { AlertTriangle, X } from 'lucide-react';

export default function SubmitConfirmModal({ categoryName, onConfirm, onCancel }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      <div 
        className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-200 bg-[var(--bg-primary)] border border-[var(--border-color)]"
      >
        <div className="flex items-center justify-between px-6 py-4 bg-[var(--bg-tertiary)] border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-[var(--color-warning)]" />
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
              Confirm Submission
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            autoFocus
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="text-[var(--text-secondary)]">
            You are about to submit scores for{' '}
            <span className="font-semibold text-[var(--text-primary)]">
              {categoryName}
            </span>.
          </p>
          <p className="mt-2 text-sm font-medium text-[var(--color-warning)]">
            You will not be able to edit these scores after submission unless the admin unlocks them.
          </p>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-[var(--hover-bg)] border border-[var(--border-color)]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors bg-[var(--color-accent)] text-white hover:opacity-90"
          >
            Submit Scores
          </button>
        </div>
      </div>
    </div>
  );
}