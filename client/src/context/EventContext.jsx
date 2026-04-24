import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { eventsAPI } from '../api';

const EventContext = createContext(null);

const STORAGE_KEY = 'selected_event_id';

export function EventProvider({ children }) {
  const [selectedEventId, setSelectedEventIdState] = useState(null);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (events.length > 0 && !selectedEventId) {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      const savedId = saved ? parseInt(saved, 10) : null;
      const event = events.find(e => e.id === savedId) || events.find(e => e.status === 'active') || events[0];
      if (event) {
        setSelectedEventIdState(event.id);
        setSelectedEvent(event);
      }
    }
  }, [events, selectedEventId]);

  const loadEvents = async () => {
    try {
      const res = await eventsAPI.getAll();
      setEvents(res.data);
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoading(false);
    }
  };

  const setSelectedEventId = useCallback((id) => {
    const event = events.find(e => e.id === id);
    if (event) {
      setSelectedEventIdState(id);
      setSelectedEvent(event);
      sessionStorage.setItem(STORAGE_KEY, id);
    }
  }, [events]);

  const refreshEvents = useCallback(() => {
    loadEvents();
  }, []);

  return (
    <EventContext.Provider value={{
      selectedEventId,
      selectedEvent,
      events,
      loading,
      setSelectedEventId,
      refreshEvents,
    }}>
      {children}
    </EventContext.Provider>
  );
}

export function useEvent() {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error('useEvent must be used within EventProvider');
  }
  return context;
}