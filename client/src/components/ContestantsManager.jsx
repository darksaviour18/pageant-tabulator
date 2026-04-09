import { useEffect, useState } from 'react';
import { contestantsAPI } from '../api';
import { Trash2, Plus, Edit2 } from 'lucide-react';

export default function ContestantsManager({ eventId }) {
  const [contestants, setContestants] = useState([]);
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadContestants();
  }, [eventId]);

  const loadContestants = async () => {
    try {
      const res = await contestantsAPI.getAll(eventId);
      setContestants(res.data);
    } catch (err) {
      console.error('Failed to load contestants:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const num = parseInt(number);
    if (!number || isNaN(num) || num < 1) {
      setError('Contestant number must be a positive integer');
      return;
    }
    if (!name.trim()) {
      setError('Contestant name is required');
      return;
    }

    setLoading(true);
    try {
      await contestantsAPI.create(eventId, {
        number: num,
        name: name.trim(),
      });
      setNumber('');
      setName('');
      setSuccess(`Contestant #${num} "${name}" added`);
      await loadContestants();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add contestant');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (id, contestantName) => {
    if (!confirm(`Mark "${contestantName}" as withdrawn?`)) return;

    try {
      await contestantsAPI.delete(id);
      setSuccess(`"${contestantName}" marked as withdrawn`);
      await loadContestants();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to withdraw contestant');
    }
  };

  const activeContestants = contestants.filter((c) => c.status === 'active');

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-slate-900">Contestants</h2>
      </div>

      {/* Add Contestant Form */}
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="number"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="Contestant #"
          min="1"
          className="w-32 px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Contestant name"
          className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Contestant
        </button>
      </form>

      {/* Feedback */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg mb-4">
          {error}
        </div>
      )}
      {success && (
        <div className="text-sm text-green-600 bg-green-50 px-4 py-2 rounded-lg mb-4">
          {success}
        </div>
      )}

      {/* Contestants Table */}
      {activeContestants.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 text-slate-500 font-medium">#</th>
                <th className="text-left py-3 px-4 text-slate-500 font-medium">Name</th>
                <th className="text-left py-3 px-4 text-slate-500 font-medium">Status</th>
                <th className="text-right py-3 px-4 text-slate-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeContestants.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-slate-100 hover:bg-slate-50 transition"
                >
                  <td className="py-3 px-4 text-slate-900 font-medium">{c.number}</td>
                  <td className="py-3 px-4 text-slate-700">{c.name}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Active
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleWithdraw(c.id, c.name)}
                      className="text-red-500 hover:text-red-700 transition-colors p-1"
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
        <div className="text-center py-8 text-slate-400">
          No contestants added yet. Add your first contestant above.
        </div>
      )}
    </div>
  );
}
