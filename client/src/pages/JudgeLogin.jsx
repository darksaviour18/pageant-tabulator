import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI, eventsAPI } from '../api';
import { Crown, AlertCircle } from 'lucide-react';

const JUDGE_SESSION_KEY = 'judge_session';

export default function JudgeLogin() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState('');
  const [seatNumber, setSeatNumber] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingEvents, setLoadingEvents] = useState(true);

  useEffect(() => {
    loadActiveEvents();
  }, []);

  const loadActiveEvents = async () => {
    try {
      const res = await eventsAPI.getAll();
      setEvents(res.data.filter((e) => e.status === 'active'));
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!eventId) {
      setError('Please select an event');
      return;
    }
    if (!seatNumber) {
      setError('Please select your seat number');
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setError('PIN must be exactly 4 digits');
      return;
    }

    setLoading(true);
    try {
      const res = await authAPI.login({
        event_id: parseInt(eventId, 10),
        seat_number: parseInt(seatNumber, 10),
        pin,
      });

      // Store session in sessionStorage
      sessionStorage.setItem(
        JUDGE_SESSION_KEY,
        JSON.stringify({
          judgeId: res.data.judge.id,
          eventId: res.data.event.id,
          judgeName: res.data.judge.name,
          seatNumber: res.data.judge.seat_number,
          eventName: res.data.event.name,
        })
      );

      navigate('/judge/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  if (loadingEvents) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-slate-400 text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/10 mb-4">
            <Crown className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">
            Pageant Tabulator <span className="text-amber-400">Pro</span>
          </h1>
          <p className="text-slate-400 mt-1">Judge Scoring Portal</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-semibold text-slate-900 mb-6">Judge Login</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Event Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Select Event
              </label>
              <select
                value={eventId}
                onChange={(e) => {
                  setEventId(e.target.value);
                  setSeatNumber('');
                }}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none bg-white"
                disabled={events.length === 0}
              >
                <option value="">Choose an event...</option>
                {events.map((evt) => (
                  <option key={evt.id} value={evt.id}>
                    {evt.name}
                  </option>
                ))}
              </select>
              {events.length === 0 && (
                <p className="text-xs text-slate-400 mt-1.5">
                  No active events found. Contact your admin.
                </p>
              )}
            </div>

            {/* Seat Number */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Seat Number
              </label>
              <select
                value={seatNumber}
                onChange={(e) => setSeatNumber(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none bg-white"
                disabled={!eventId}
              >
                <option value="">Select your seat...</option>
                {eventId &&
                  Array.from({ length: 20 }, (_, i) => i + 1).map((num) => (
                    <option key={num} value={num}>
                      Judge {num}
                    </option>
                  ))}
              </select>
            </div>

            {/* PIN */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Enter PIN
              </label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
                maxLength={4}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-center text-2xl tracking-[0.5em] font-mono"
                disabled={!seatNumber}
              />
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !eventId || !seatNumber || pin.length !== 4}
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Admin Link */}
        <div className="text-center mt-6">
          <a
            href="/"
            className="text-sm text-slate-500 hover:text-amber-400 transition-colors"
          >
            ← Back to Admin Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
