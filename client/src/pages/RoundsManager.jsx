import { useState, useEffect } from 'react';
import { eventsAPI, categoriesAPI } from '../api';
import EliminationRoundManager from '../components/EliminationRoundManager';

export default function RoundsManager() {
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState('');
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    eventsAPI.getAll().then((res) => setEvents(res.data || [])).catch(console.error);
  }, []);

  const handleEventChange = async (e) => {
    const id = e.target.value;
    setEventId(id);
    setCategories([]);

    if (id) {
      setLoading(true);
      try {
        const catsRes = await categoriesAPI.getAll(parseInt(id, 10));
        setCategories(catsRes.data || []);
      } catch (err) {
        console.error('Failed to load event data:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[var(--color-text)]">Rounds Management</h2>
        <select
          value={eventId}
          onChange={handleEventChange}
          className="w-64 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
        >
          <option value="">Select an event...</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} ({e.status})
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="text-center py-8 text-slate-400">Loading...</div>
      )}

      {!eventId && !loading && (
        <div className="text-center py-12 text-slate-400">
          <p className="text-lg">Select an event to manage elimination rounds.</p>
        </div>
      )}

      {eventId && !loading && (
        <EliminationRoundManager
          eventId={parseInt(eventId, 10)}
          categories={categories}
          standalone
        />
      )}
    </div>
  );
}
