import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI, eventsAPI, judgesAPI } from '../api';
import { Crown, AlertCircle } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import Button from '../components/Button';
import ThemeToggle from '../components/ThemeToggle';

const JUDGE_SESSION_KEY = 'judge_session';

export default function JudgeLogin() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState('');
  const [judges, setJudges] = useState([]);
  const [loadingJudges, setLoadingJudges] = useState(false);
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
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
        <div className="text-[var(--color-text-muted)] text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4">
      {/* Theme Toggle in top-right corner */}
      <div className="fixed top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[var(--color-primary-light)] to-[var(--color-secondary-light)] mb-4 ring-1 ring-[var(--color-primary)]">
            <Crown className="w-10 h-10 text-[var(--color-cta)]" />
          </div>
          <h1 className="text-3xl font-bold text-[var(--color-text)] tracking-tight">
            Pageant Tabulator <span className="text-[var(--color-cta)]">Pro</span>
          </h1>
          <p className="text-[var(--color-text-muted)] mt-2 text-sm">Judge Scoring Portal</p>
        </div>

        {/* Login Card */}
        <div className="bg-[var(--color-bg-elevated)] backdrop-blur-xl rounded-2xl shadow-xl p-8 border border-[var(--color-border)]">
          <h2 className="text-xl font-semibold text-[var(--color-text)] mb-6">Judge Login</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Event Selection */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                Select Event
              </label>
              <select
                value={eventId}
                onChange={async (e) => {
                  const id = e.target.value;
                  setEventId(id);
                  setSeatNumber('');
                  setJudges([]);
                  if (!id) return;

                  setLoadingJudges(true);
                  try {
                    const res = await judgesAPI.getAll(parseInt(id, 10));
                    setJudges(res.data);
                  } catch (err) {
                    console.error('Failed to load judges:', err);
                  } finally {
                    setLoadingJudges(false);
                  }
                }}
                className="w-full px-4 py-3 min-h-[48px] bg-[var(--color-bg-subtle)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] 
                  focus:ring-2 focus:ring-[var(--color-cta)]/50 focus:border-[var(--color-cta)] outline-none 
                  transition-all duration-200"
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
                <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
                  No active events found. Contact your admin.
                </p>
              )}
            </div>

            {/* Seat Number */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                Seat Number
              </label>
              <select
                value={seatNumber}
                onChange={(e) => setSeatNumber(e.target.value)}
                className="w-full px-4 py-3 min-h-[48px] bg-[var(--color-bg-subtle)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] 
                  focus:ring-2 focus:ring-[var(--color-cta)]/50 focus:border-[var(--color-cta)] outline-none 
                  transition-all duration-200 disabled:opacity-50"
                disabled={!eventId || judges.length === 0 || loadingJudges}
              >
                <option value="">Select your seat...</option>
                {loadingJudges && <option disabled>Loading judges...</option>}
                {judges.map((j) => (
                  <option key={j.id} value={j.seat_number}>
                    {j.name} (Seat #{j.seat_number})
                  </option>
                ))}
                {!loadingJudges && eventId && judges.length === 0 && (
                  <option disabled>No judges assigned</option>
                )}
              </select>
            </div>

            {/* PIN */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                Enter PIN
              </label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
                maxLength={4}
                className="w-full px-4 py-3 min-h-[48px] bg-[var(--color-bg-subtle)] border border-[var(--color-border)] rounded-lg 
                  text-center text-2xl tracking-[0.5em] font-mono text-[var(--color-text)] placeholder-[var(--color-text-muted)]
                  focus:ring-2 focus:ring-[var(--color-cta)]/50 focus:border-[var(--color-cta)] outline-none 
                  transition-all duration-200 disabled:opacity-50"
                disabled={!seatNumber}
              />
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 text-sm text-[var(--color-error)] bg-[var(--color-error)]/10 px-4 py-3 rounded-lg border border-[var(--color-error)]/20">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              disabled={!eventId || !seatNumber || pin.length !== 4}
              className="w-full"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </div>

        {/* Admin Link */}
        <div className="text-center mt-6">
          <a
            href="/"
            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-cta)] transition-colors"
          >
            ← Back to Admin Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}