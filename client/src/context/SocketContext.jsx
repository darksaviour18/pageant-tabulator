import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { checkAdminSession, ADMIN_TOKEN_KEY } from '../pages/AdminLogin';
import { getJudgeSession } from '../utils/session';

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
  const [reconnectCount, setReconnectCount] = useState(0);
  const heartbeatTimerRef = useRef(null);

  useEffect(() => {
    // Build auth payload from current session — read fresh on every call
    const getAuthPayload = () => {
      const isAdminRoute = window.location.pathname === '/' || window.location.pathname.startsWith('/admin');
      const hasAdminSession = checkAdminSession();
      const judgeSession = getJudgeSession();

      if (isAdminRoute && hasAdminSession) return { role: 'admin' };
      if (judgeSession?.judgeId && judgeSession?.eventId)
        return { role: 'judge', judgeId: judgeSession.judgeId, eventId: judgeSession.eventId };
      return { role: 'judge' };
    };

    // Determine handshake role and token
    const isAdminRoute = window.location.pathname === '/' || window.location.pathname.startsWith('/admin');
    const hasAdminSession = checkAdminSession();
    const adminToken = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    const handshakeRole = isAdminRoute && hasAdminSession ? 'admin' : 'judge';

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      auth: {
        role: handshakeRole,
        token: adminToken || undefined,
      },
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      const payload = getAuthPayload();
      console.log('[Socket] Connected:', socket.id, 'as', payload.role);
      setConnected(true);
      socket.emit('authenticate', payload);
    });

    socket.on('authenticated', (data) => {
      console.log('[Socket] Authenticated:', data);
      if (data.success && !heartbeatTimerRef.current) {
        heartbeatTimerRef.current = setInterval(() => {
          socket.emit('heartbeat');
        }, 3000);
      }
    });

    socket.on('heartbeat_ack', (data) => {
      setLastSync(Date.now());
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setConnected(false);
      setLastSync(null);
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    });

    // 10.1.3: Emit reconnect event for listeners
    socket.on('reconnect', (attempt) => {
      console.log(`[Socket] Reconnected after ${attempt} attempts`);
      setReconnectCount((prev) => prev + 1);
      const payload = getAuthPayload();
      socket.emit('authenticate', payload);
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
      setConnected(false);
    });

    return () => {
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      socket.close();
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
    <SocketContext.Provider value={{ connected, lastSync, reconnectCount, onEvent, emit }}>
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
