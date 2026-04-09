import { useEffect, useState } from 'react';
import { judgesAPI } from '../api';
import { Trash2, Plus } from 'lucide-react';

export default function JudgesManager({ eventId }) {
  const [judges, setJudges] = useState([]);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadJudges();
  }, [eventId]);

  const loadJudges = async () => {
    try {
      const res = await judgesAPI.getAll(eventId);
      setJudges(res.data);
    } catch (err) {
      console.error('Failed to load judges:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!name.trim()) {
      setError('Judge name is required');
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setError('PIN must be exactly 4 digits');
      return;
    }

    setLoading(true);
    try {
      const seat_number = judges.length + 1;
      await judgesAPI.create(eventId, {
        seat_number,
        name: name.trim(),
        pin,
      });
      setName('');
      setPin('');
      setSuccess(`Judge ${name} added as Seat #${seat_number}`);
      await loadJudges();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add judge');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (judgeId, judgeName) => {
    if (!confirm(`Remove judge "${judgeName}"?`)) return;

    try {
      await judgesAPI.delete(eventId, judgeId);
      setSuccess(`Judge "${judgeName}" removed`);
      await loadJudges();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove judge');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-slate-900">Judges</h2>
      </div>

      {/* Add Judge Form */}
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Judge name"
          className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
        />
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="4-digit PIN"
          maxLength={4}
          className="w-32 px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-center tracking-widest"
        />
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Judge
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

      {/* Judges Table */}
      {judges.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 text-slate-500 font-medium">#</th>
                <th className="text-left py-3 px-4 text-slate-500 font-medium">Name</th>
                <th className="text-left py-3 px-4 text-slate-500 font-medium">PIN</th>
                <th className="text-right py-3 px-4 text-slate-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {judges.map((judge) => (
                <tr
                  key={judge.id}
                  className="border-b border-slate-100 hover:bg-slate-50 transition"
                >
                  <td className="py-3 px-4 text-slate-900 font-medium">
                    {judge.seat_number}
                  </td>
                  <td className="py-3 px-4 text-slate-700">{judge.name}</td>
                  <td className="py-3 px-4 text-slate-400 tracking-widest">••••</td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleDelete(judge.id, judge.name)}
                      className="text-red-500 hover:text-red-700 transition-colors p-1"
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
        <div className="text-center py-8 text-slate-400">
          No judges added yet. Add your first judge above.
        </div>
      )}
    </div>
  );
}
