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
    // Check session type (admin or judge)
    const isAdminRoute = window.location.pathname === '/' || window.location.pathname.startsWith('/admin');
    const hasAdminSession = checkAdminSession();
    const adminToken = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    const judgeSession = getJudgeSession();

    // Determine role and credentials
    let authRole = 'judge';
    let authPayload = { role: 'judge' };
    
    if (isAdminRoute && hasAdminSession) {
      authRole = 'admin';
      authPayload = { role: 'admin' };
    } else if (judgeSession?.judgeId && judgeSession?.eventId) {
      // Judge session exists - authenticate as judge with credentials
      authRole = 'judge';
      authPayload = { role: 'judge', judgeId: judgeSession.judgeId, eventId: judgeSession.eventId };
    }

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      auth: {
        role: authRole,
        token: adminToken || undefined,
      },
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id, 'as', authRole);
      setConnected(true);
      // Authenticate with role and credentials
      socket.emit('authenticate', authPayload);
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
      // Re-authenticate on reconnect
      socket.emit('authenticate', authPayload);
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
