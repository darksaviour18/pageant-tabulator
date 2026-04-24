import { useState, useEffect } from 'react';
import { auditLogsAPI } from '../api';
import { useEvent } from '../context/EventContext';
import { Clock, User, Filter } from 'lucide-react';

const ACTION_LABELS = {
  score_entered: 'Score Entered',
  category_submitted: 'Category Submitted',
  category_unlocked: 'Category Unlocked',
  category_locked: 'Category Locked',
  judge_login: 'Judge Login',
  event_created: 'Event Created',
  event_updated: 'Event Updated',
};

export default function AuditLogs() {
  const { selectedEventId } = useEvent();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('');
  const [pagination, setPagination] = useState({ limit: 50, offset: 0, hasMore: false });

  useEffect(() => {
    if (selectedEventId) {
      loadLogs();
    }
  }, [selectedEventId, filterAction, pagination.offset]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await auditLogsAPI.getAll(selectedEventId, {
        limit: pagination.limit,
        offset: pagination.offset,
        action: filterAction || undefined,
      });
      setLogs(res.data);
      setPagination(prev => ({ ...prev, hasMore: res.data.length === prev.limit }));
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (ts) => {
    const date = new Date(ts);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getActionBadge = (action) => {
    const styles = {
      score_entered: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      category_submitted: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      category_unlocked: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      category_locked: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      judge_login: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      event_created: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
      event_updated: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
    };
    return styles[action] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
  };

  if (!selectedEventId) {
    return (
      <div className="text-center py-20">
        <p className="text-[var(--color-text-muted)]">Select an event to view audit logs</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-[var(--color-text)]">Audit Log</h2>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[var(--color-text-muted)]" />
          <select
            value={filterAction}
            onChange={(e) => {
              setFilterAction(e.target.value);
              setPagination(prev => ({ ...prev, offset: 0 }));
            }}
            className="px-3 py-1.5 border border-[var(--color-border)] rounded-lg text-sm bg-[var(--color-bg)] text-[var(--color-text)]"
          >
            <option value="">All Actions</option>
            {Object.keys(ACTION_LABELS).map(action => (
              <option key={action} value={action}>{ACTION_LABELS[action]}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-[var(--color-text-muted)]">Loading...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-20 text-[var(--color-text-muted)]">No audit logs found</div>
      ) : (
        <div className="bg-[var(--color-bg-subtle)] rounded-xl border border-[var(--color-border)] overflow-hidden">
          <div className="divide-y divide-[var(--color-border)] max-h-[600px] overflow-y-auto">
            {logs.map(log => (
              <div key={log.id} className="flex items-start gap-4 p-4 hover:bg-[var(--color-bg)] transition-colors">
                <Clock className="w-4 h-4 mt-1 text-[var(--color-text-muted)] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getActionBadge(log.action)}`}>
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                    <span className="text-sm text-[var(--color-text-muted)]">
                      {formatTimestamp(log.timestamp)}
                    </span>
                  </div>
                  {log.judge_name && (
                    <div className="flex items-center gap-1 mt-1 text-sm text-[var(--color-text-muted)]">
                      <User className="w-3 h-3" />
                      {log.judge_name}
                    </div>
                  )}
                  {log.details && (
                    <pre className="mt-1 text-xs text-[var(--color-text-muted)] whitespace-pre-wrap break-all">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pagination.hasMore && (
        <div className="flex justify-center">
          <button
            onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
            className="px-4 py-2 text-sm text-[var(--color-cta)] hover:underline"
          >
            Load More
          </button>
        </div>
      )}
    </div>
  );
}