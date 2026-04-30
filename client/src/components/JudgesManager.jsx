import { useState } from 'react';
import { judgesAPI } from '../api';
import { useCrudResource } from '../hooks/useCrudResource';
import { Trash2, Plus, Eye, EyeOff } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';

export default function JudgesManager({ eventId }) {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [visiblePins, setVisiblePins] = useState({});

  const { items: judges, loading, error, success, handleCreate, handleDelete } = useCrudResource(
    judgesAPI,
    { collectionKey: eventId }
  );

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim()) return;
    if (!/^\d{4}$/.test(pin)) return;

    const seat_number = judges.length + 1;
    const ok = await handleCreate({
      seat_number,
      name: name.trim(),
      pin,
    });

    if (ok) {
      setName('');
      setPin('');
    }
  };

  const togglePinVisibility = (judgeId) => {
    setVisiblePins(prev => ({
      ...prev,
      [judgeId]: !prev[judgeId]
    }));
  };

  const handleRemove = async (judgeId, judgeName) => {
    setConfirmDelete({
      open: true,
      title: 'Remove Judge',
      message: `Remove "${judgeName}" from this event? This cannot be undone.`,
      confirmLabel: 'Remove',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDelete(null);
        await handleDelete(judgeId);
      },
      onCancel: () => setConfirmDelete(null),
    });
  };

  return (
    <div className="bg-[var(--color-bg-subtle)] rounded-xl shadow-sm border border-[var(--color-border)] p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-[var(--color-text)]">Judges</h2>
      </div>

      {/* Add Judge Form */}
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Judge name"
          className="flex-1 px-4 py-2.5 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-cta)] focus:border-[var(--color-cta)] outline-none bg-[var(--color-bg)] text-[var(--color-text)]"
        />
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="4-digit PIN"
          maxLength={4}
          className="w-32 px-4 py-2.5 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-cta)] focus:border-[var(--color-cta)] outline-none text-center tracking-widest bg-[var(--color-bg)] text-[var(--color-text)]"
        />
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-cta)] hover:opacity-90 disabled:opacity-50 text-white font-medium rounded-lg transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Add Judge
        </button>
      </form>

      {/* Feedback */}
      {error && (
        <div className="text-sm text-red-500 bg-red-500/10 px-4 py-2 rounded-lg mb-4">
          {error}
        </div>
      )}
      {success && (
        <div className="text-sm text-green-500 bg-green-500/10 px-4 py-2 rounded-lg mb-4">
          {success}
        </div>
      )}

      {/* Judges Table */}
      {judges.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left py-3 px-4 text-[var(--color-text-muted)] font-medium">#</th>
                <th className="text-left py-3 px-4 text-[var(--color-text-muted)] font-medium">Name</th>
                <th className="text-left py-3 px-4 text-[var(--color-text-muted)] font-medium">PIN</th>
                <th className="text-right py-3 px-4 text-[var(--color-text-muted)] font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {judges.map((judge) => (
                <tr
                  key={judge.id}
                  className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg)] transition"
                >
                  <td className="py-3 px-4 text-[var(--color-text)] font-medium">
                    {judge.seat_number}
                  </td>
                  <td className="py-3 px-4 text-[var(--color-text)]">{judge.name}</td>
                  <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="tracking-widest text-[var(--color-text-muted)]">
                          {visiblePins[judge.id] ? judge.pin : '••••'}
                        </span>
                        <button
                          onClick={() => togglePinVisibility(judge.id)}
                          className="text-[var(--color-text-muted)] hover:text-[var(--color-cta)] p-1"
                          title={visiblePins[judge.id] ? 'Hide PIN' : 'Show PIN'}
                        >
                          {visiblePins[judge.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleRemove(judge.id, judge.name)}
                      className="text-red-500 hover:text-red-400 transition-colors p-1"
                      title="Remove judge"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 text-[var(--color-text-muted)]">
          No judges added yet. Add your first judge above.
        </div>
      )}
      <ConfirmDialog {...confirmDelete} />
    </div>
  );
}
