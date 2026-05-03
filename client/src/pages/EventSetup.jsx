import { useEffect, useState } from 'react';
import { eventsAPI } from '../api';
import JudgesManager from '../components/JudgesManager';
import ContestantsManager from '../components/ContestantsManager';
import CategoriesManager from '../components/CategoriesManager';
import { useEvent } from '../context/EventContext';

export default function EventSetup() {
  const { selectedEventId, selectedEvent, setSelectedEventId, refreshEvents } = useEvent();
  const [eventName, setEventName] = useState('');
  const [status, setStatus] = useState('active');
  const [tabulators, setTabulators] = useState('');
  const [scoringMode, setScoringMode] = useState('direct');
  const [hasScores, setHasScores] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (selectedEvent) {
      setEventName(selectedEvent.name);
      setStatus(selectedEvent.status);
      setTabulators(selectedEvent.tabulators ? JSON.parse(selectedEvent.tabulators).map(t => t.name).join('\n') : '');
      setIsEditing(true);
    } else {
      setEventName('');
      setStatus('active');
      setTabulators('');
      setIsEditing(false);
    }
  }, [selectedEvent]);

  // Fetch event detail for has_scores (not included in list endpoint)
  useEffect(() => {
    if (selectedEventId) {
      eventsAPI.getById(selectedEventId).then(res => {
        setHasScores(!!res.data.has_scores);
        setScoringMode(res.data.scoring_mode || 'direct');
      }).catch(() => {});
    } else {
      setHasScores(false);
      setScoringMode('direct');
    }
  }, [selectedEventId]);

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

      if (isEditing && selectedEventId) {
        const res = await eventsAPI.update(selectedEventId, { name: eventName, status, tabulators: tabulatorList, scoring_mode: scoringMode });
        setSelectedEventId(res.data.id);
        setEventName(res.data.name);
        setStatus(res.data.status);
        setScoringMode(res.data.scoring_mode || 'direct');
        setSuccess('Event updated successfully');
        refreshEvents();
      } else {
        const res = await eventsAPI.create(eventName);
        setSelectedEventId(res.data.id);
        setStatus(res.data.status);
        setIsEditing(true);
        if (tabulatorList.length > 0) {
          await eventsAPI.update(res.data.id, { tabulators: tabulatorList });
        }
        refreshEvents();
        setSuccess('Event created successfully');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save event');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Event Configuration */}
      <div className="bg-[var(--color-bg-subtle)] rounded-xl shadow-sm border border-[var(--color-border)] p-6">
        <h2 className="text-xl font-semibold text-[var(--color-text)] mb-4">
          Event Configuration
        </h2>

        {!selectedEventId && !isEditing && (
          <div className="text-center mb-6">
            <p className="text-[var(--color-text-muted)] text-lg mb-2">No events found</p>
            <p className="text-[var(--color-text-muted)] text-sm">Create your first event to get started</p>
          </div>
        )}

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
                Scoring Mode
              </label>
              <div className="flex gap-4">
                <label className={`flex items-center gap-2 ${hasScores ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <input
                    type="radio"
                    name="scoring_mode"
                    value="direct"
                    checked={scoringMode === 'direct'}
                    onChange={() => setScoringMode('direct')}
                    disabled={hasScores}
                    className="text-[var(--color-cta)] focus:ring-[var(--color-cta)]"
                  />
                  <span className="text-sm text-[var(--color-text)]">Direct by Weight</span>
                  <span className="text-xs text-[var(--color-text-muted)]">Score up to weight-based max (0-40, 0-60, etc.). Total sums to 100.</span>
                </label>
                <label className={`flex items-center gap-2 ${hasScores ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <input
                    type="radio"
                    name="scoring_mode"
                    value="weighted"
                    checked={scoringMode === 'weighted'}
                    onChange={() => setScoringMode('weighted')}
                    disabled={hasScores}
                    className="text-[var(--color-cta)] focus:ring-[var(--color-cta)]"
                  />
                  <span className="text-sm text-[var(--color-text)]">Standard (1-10)</span>
                  <span className="text-xs text-[var(--color-text-muted)]">Score each criterion 1-10. Weight determines contribution to total.</span>
                </label>
              </div>
              {hasScores && (
                <p className="text-xs text-amber-500 mt-1">Scoring mode cannot be changed after judging has started.</p>
              )}
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
      {selectedEventId && (
        <>
          <CategoriesManager eventId={selectedEventId} />
          <JudgesManager eventId={selectedEventId} />
          <ContestantsManager eventId={selectedEventId} />
        </>
      )}
    </div>
  );
}
