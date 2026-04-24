import { useMemo, memo } from 'react';

const SyncStatus = memo(function SyncStatus({ connected, lastSync }) {
  const timeSinceSync = useMemo(() => {
    if (!lastSync) return null;
    const diff = Math.floor((Date.now() - lastSync) / 1000);
    if (diff < 5) return 'just now';
    if (diff < 60) return `${diff}s ago`;
    return `${Math.floor(diff / 60)}m ago`;
  }, [lastSync]);

  if (!lastSync) return null;

  return (
    <div className="flex items-center gap-3">
      <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className="text-sm text-[var(--color-text-muted)]">
        {connected ? `Connected · Last sync: ${timeSinceSync || '...'}` : 'Disconnected'}
      </span>
    </div>
  );
});

export default SyncStatus;