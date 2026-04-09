import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

/**
 * Socket.io context provider.
 *
 * Automatically connects on mount, authenticates as admin,
 * and maintains heartbeat every 3 seconds.
 */
export function SocketProvider({ children }) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const heartbeatTimerRef = useRef(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
      setConnected(true);
      // Authenticate as admin
      socket.emit('authenticate', { role: 'admin' });
    });

    socket.on('authenticated', (data) => {
      console.log('[Socket] Admin authenticated:', data.success);
      if (data.success) {
        // Start heartbeat
        if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = setInterval(() => {
          socket.emit('heartbeat');
        }, 3000);
      }
    });

    socket.on('heartbeat_ack', (data) => {
      setLastSync(Date.now());
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
      setConnected(false);
      setLastSync(null);
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
      setConnected(false);
    });

    return () => {
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      socket.disconnect();
    };
  }, []);

  /**
   * Subscribe to a socket event.
   * Returns an unsubscribe function.
   */
  const onEvent = useCallback((event, handler) => {
    const socket = socketRef.current;
    if (!socket) return () => {};
    socket.on(event, handler);
    return () => socket.off(event, handler);
  }, []);

  /**
   * Emit an event to the server.
   */
  const emit = useCallback((event, data) => {
    socketRef.current?.emit(event, data);
  }, []);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected, lastSync, onEvent, emit }}>
      {children}
    </SocketContext.Provider>
  );
}

/**
 * Hook to access the socket context.
 */
export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return ctx;
}
