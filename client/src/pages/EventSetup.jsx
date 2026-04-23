import { useEffect, useState } from 'react';
import { eventsAPI } from '../api';
import JudgesManager from '../components/JudgesManager';
import ContestantsManager from '../components/ContestantsManager';
import CategoriesManager from '../components/CategoriesManager';

export default function EventSetup() {
  const [eventName, setEventName] = useState('');
  const [eventId, setEventId] = useState(null);
  const [status, setStatus] = useState('active');
  const [tabulators, setTabulators] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadEvent();
  }, []);

  const loadEvent = async () => {
    try {
      const res = await eventsAPI.getAll();
      const activeEvent = res.data.find((e) => e.status === 'active');
      if (activeEvent) {
        setEventId(activeEvent.id);
        setEventName(activeEvent.name);
        setStatus(activeEvent.status);
        setTabulators(activeEvent.tabulators ? JSON.parse(activeEvent.tabulators).map(t => t.name).join('\n') : '');
        setIsEditing(true);
      }
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    if (!eventName.trim()) {
      setError('Event name is required');
      setSubmitting(false);
      return;
    }

    try {
      const tabulatorList = tabulators
        .split('\n')
        .map(t => t.trim())
        .filter(Boolean)
        .map(name => ({ name }));

      if (isEditing && eventId) {
        const res = await eventsAPI.update(eventId, { name: eventName, status, tabulators: tabulatorList });
        setEventId(res.data.id);
        setEventName(res.data.name);
        setStatus(res.data.status);
        setSuccess('Event updated successfully');
      } else {
        const res = await eventsAPI.create(eventName);
        setEventId(res.data.id);
        setStatus(res.data.status);
        setIsEditing(true);
        if (tabulatorList.length > 0) {
          await eventsAPI.update(res.data.id, { tabulators: tabulatorList });
        }
        setSuccess('Event created successfully');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save event');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-[var(--color-text-muted)] text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Event Configuration */}
      <div className="bg-[var(--color-bg-subtle)] rounded-xl shadow-sm border border-[var(--color-border)] p-6">
        <h2 className="text-xl font-semibold text-[var(--color-text)] mb-4">
          Event Configuration
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
              Event Name
            </label>
            <input
              type="text"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="e.g., Miss Universe 2026"
              className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-cta)] focus:border-[var(--color-cta)] outline-none transition bg-[var(--color-bg)] text-[var(--color-text)]"
            />
          </div>
          {isEditing && (
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                Tabulator Names (one per line)
              </label>
              <textarea
                value={tabulators}
                onChange={(e) => setTabulators(e.target.value)}
                placeholder="REYMOND ABELLA&#10;RHAIAN DELA TORRE"
                rows={3}
                className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-cta)] focus:border-[var(--color-cta)] outline-none resize-none transition bg-[var(--color-bg)] text-[var(--color-text)]"
              />
              <p className="text-xs text-[var(--color-text-muted)] mt-1">These names appear on report footprints when "Tabulators" signature type is selected.</p>
            </div>
          )}
          {isEditing && (
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                Status
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="status"
                    value="active"
                    checked={status === 'active'}
                    onChange={() => setStatus('active')}
                    className="text-[var(--color-cta)] focus:ring-[var(--color-cta)]"
                  />
                  <span className="text-sm text-[var(--color-text)]">Active</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="status"
                    value="archived"
                    checked={status === 'archived'}
                    onChange={() => setStatus('archived')}
                    className="text-[var(--color-cta)] focus:ring-[var(--color-cta)]"
                  />
                  <span className="text-sm text-[var(--color-text)]">Archived</span>
                </label>
              </div>
            </div>
          )}
          {error && (
            <div className="text-sm text-red-500 bg-red-500/10 px-4 py-2 rounded-lg">
              {error}
            </div>
          )}
          {success && (
            <div className="text-sm text-green-500 bg-green-500/10 px-4 py-2 rounded-lg">
              {success}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-2.5 bg-[var(--color-cta)] hover:opacity-90 disabled:opacity-50 text-white font-medium rounded-lg transition-all active:scale-95"
          >
            {submitting ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving...
              </>
            ) : (
              isEditing ? 'Save Changes' : 'Create Event'
            )}
          </button>
        </form>
      </div>

      {/* Managers (only shown when an event exists) */}
      {eventId && (
        <>
          <CategoriesManager eventId={eventId} />
          <JudgesManager eventId={eventId} />
          <ContestantsManager eventId={eventId} />
        </>
      )}
    </div>
  );
}
