import { AlertTriangle, X } from 'lucide-react';

/**
 * Confirmation modal for category submission.
 * Shows the category name and warns the judge they cannot edit after submission.
 */
export default function SubmitConfirmModal({ categoryName, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-red-50 border-b border-red-100">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h3 className="text-lg font-semibold text-red-700">Confirm Submission</h3>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-slate-700">
            You are about to submit scores for{' '}
            <span className="font-semibold text-slate-900">{categoryName}</span>.
          </p>
          <p className="mt-2 text-sm text-red-600 font-medium">
            ⚠ You will not be able to edit these scores after submission unless the admin unlocks them.
          </p>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 bg-slate-50 border-t border-slate-200">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
          >
            Submit Scores
          </button>
        </div>
      </div>
    </div>
  );
}
