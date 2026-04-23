import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  const variants = {
    default: {
      icon: 'text-[var(--color-warning)]',
      header: 'bg-[var(--bg-tertiary)]',
      confirmBtn: 'bg-[var(--color-accent)] text-white hover:opacity-90',
    },
    danger: {
      icon: 'text-[var(--color-error)]',
      header: 'bg-[var(--color-error)]/10',
      confirmBtn: 'bg-[var(--color-error)] text-white hover:opacity-90',
    },
  };

  const v = variants[variant] || variants.default;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      
      <div className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-200 bg-[var(--bg-primary)] border border-[var(--border-color)]">
        <div className={`flex items-center gap-3 px-6 py-4 ${v.header} border-b border-[var(--border-color)]`}>
          <AlertTriangle className={`w-5 h-5 ${v.icon}`} />
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            {title}
          </h3>
          <button
            onClick={onCancel}
            className="ml-auto transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="text-[var(--text-secondary)]">{message}</p>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-[var(--hover-bg)] border border-[var(--border-color)]"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${v.confirmBtn}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}