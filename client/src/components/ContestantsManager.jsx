import { useState, useMemo } from 'react';
import { contestantsAPI } from '../api';
import { useCrudResource } from '../hooks/useCrudResource';
import { Trash2, Plus } from 'lucide-react';

export default function ContestantsManager({ eventId }) {
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');

  const { items: contestants, loading, error, success, handleCreate, handleDelete } = useCrudResource(
    contestantsAPI,
    { collectionKey: eventId }
  );

  const activeContestants = useMemo(
    () => contestants.filter((c) => c.status === 'active'),
    [contestants]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();

    const num = parseInt(number, 10);
    if (isNaN(num) || num < 1) return;
    if (!name.trim()) return;

    const ok = await handleCreate({
      number: num,
      name: name.trim(),
    });

    if (ok) {
      setNumber('');
      setName('');
    }
  };

  const handleWithdraw = async (id, contestantName) => {
    if (!confirm(`Mark "${contestantName}" as withdrawn?`)) return;
    await handleDelete(id);
  };

  return (
    <div className="bg-[var(--color-bg-subtle)] rounded-xl shadow-sm border border-[var(--color-border)] p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-[var(--color-text)]">Contestants</h2>
      </div>

      {/* Add Contestant Form */}
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="number"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="Contestant #"
          min="1"
          className="w-32 px-4 py-2.5 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-cta)] focus:border-[var(--color-cta)] outline-none bg-[var(--color-bg)] text-[var(--color-text)]"
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Contestant name"
          className="flex-1 px-4 py-2.5 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-cta)] focus:border-[var(--color-cta)] outline-none bg-[var(--color-bg)] text-[var(--color-text)]"
        />
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-cta)] hover:opacity-90 disabled:opacity-50 text-white font-medium rounded-lg transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Add Contestant
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

      {/* Contestants Table */}
      {activeContestants.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left py-3 px-4 text-[var(--color-text-muted)] font-medium">#</th>
                <th className="text-left py-3 px-4 text-[var(--color-text-muted)] font-medium">Name</th>
                <th className="text-left py-3 px-4 text-[var(--color-text-muted)] font-medium">Status</th>
                <th className="text-right py-3 px-4 text-[var(--color-text-muted)] font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeContestants.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg)] transition"
                >
                  <td className="py-3 px-4 text-[var(--color-text)] font-medium">{c.number}</td>
                  <td className="py-3 px-4 text-[var(--color-text)]">{c.name}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500">
                      Active
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleWithdraw(c.id, c.name)}
                      className="text-red-500 hover:text-red-400 transition-colors p-1"
                      title="Withdraw contestant"
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
          No contestants added yet. Add your first contestant above.
        </div>
      )}
    </div>
  );
}
