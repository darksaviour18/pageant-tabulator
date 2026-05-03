/**
 * Setup Socket.io event handlers.
 *
 * Implements SPEC.md §8 WebSocket Events:
 * - Client → Server: authenticate, heartbeat, score_update, category_submit
 * - Server → Client: authenticated, heartbeat_ack, judge_progress, score_updated,
 *   category_submitted, category_locked, sheet_unlocked, contestant_added
 */

import { getDb } from './db/init.js';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';

const HEARTBEAT_TIMEOUT_MS = 10000;
const JWT_SECRET = process.env.JWT_SECRET || process.env.ADMIN_SECRET;

if (!JWT_SECRET) {
  console.error('[Socket] FATAL: JWT_SECRET or ADMIN_SECRET must be set in environment');
  process.exit(1);
}

/**
 * Track connected judges: socketId → { judgeId, eventId, lastHeartbeat }
 */
const connectedJudges = new Map();

/**
 * Track admin connections: socketId → { role: 'admin' }
 */
const connectedAdmins = new Map();

/**
 * Heartbeat monitor interval reference for cleanup
 */
let heartbeatIntervalId = null;

/**
 * 10.1.6 + 11.4.2: Socket.io authentication middleware.
 * Validates that the client provides a valid session token on connection.
 * For admin connections, verifies the admin JWT token.
 * For judge connections, requires authenticate event after connection.
 */
function authMiddleware(socket, next) {
  const { token, role } = socket.handshake.auth;
  const cookieHeader = socket.handshake.headers.cookie;
  let jwtToken = token;

  // Try to get token from cookie if not provided in auth
  if (!jwtToken && cookieHeader) {
    const cookies = cookie.parse(cookieHeader);
    jwtToken = cookies.admin_token;
  }

  if (role === 'admin') {
    if (!jwtToken) {
      return next(new Error('Admin authentication failed'));
    }
    try {
      const decoded = jwt.verify(jwtToken, JWT_SECRET);
      if (decoded.role !== 'admin') {
        return next(new Error('Admin authentication failed'));
      }
    } catch {
      return next(new Error('Admin authentication failed'));
    }
  }

  // Judge connections: allow connection, will authenticate via 'authenticate' event
  return next();
}

/**
 * Get the Socket.io instance from the Express app.
 */
function getIo(app) {
  return app.get('io');
}

/**
 * Broadcast judge progress to all admin clients.
 */
function broadcastJudgeProgress(io, judgeId, eventId, categoryId) {
  const db = getDb();

  // Count scored cells for this judge + category
  const criteriaCount = db
    .prepare('SELECT COUNT(*) as total FROM criteria WHERE category_id = ?')
    .get(categoryId).total;

  const scoredCount = db
    .prepare(
      'SELECT COUNT(DISTINCT criteria_id) as scored FROM scores WHERE judge_id = ? AND category_id = ? AND score IS NOT NULL'
    )
    .get(judgeId, categoryId).scored;

  const submission = db
    .prepare('SELECT submitted FROM category_submissions WHERE judge_id = ? AND category_id = ?')
    .get(judgeId, categoryId);

  const judge = db
    .prepare('SELECT id, seat_number, name FROM judges WHERE id = ?')
    .get(judgeId);

  io.to('admins').emit('judge_progress', {
    judgeId,
    judgeName: judge?.name || `Judge ${judge?.seat_number || '?'}`,
    categoryId,
    scored: scoredCount,
    total: criteriaCount,
    submitted: !!submission?.submitted,
  });
}

/**
 * Broadcast a live score update to all admin clients (snake_case per SPEC.md §8).
 */
function broadcastScoreUpdate(io, judgeId, contestantId, criteriaId, categoryId, score) {
  io.to('admins').emit('score_updated', {
    judge_id: judgeId,
    contestant_id: contestantId,
    criteria_id: criteriaId,
    category_id: categoryId,
    score,
  });
}

/**
 * Setup Socket.io event handlers.
 *
 * @param {import('socket.io').Server} io
 * @param {import('express').Application} app
 */
export function setupSocketHandlers(io, app) {
  // 10.1.6: Apply auth middleware
  io.use(authMiddleware);

  // Namespace for judges
  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // --- Authentication ---
    socket.on('authenticate', (data) => {
      const { judgeId, eventId, role = 'judge' } = data;

      if (role === 'admin') {
        // Re-verify JWT — the handshake middleware already checked on connect,
        // but we must check again because any client can send role:'admin'.
        let jwtToken = socket.handshake.auth.token;
        if (!jwtToken && socket.handshake.headers.cookie) {
          const cookies = cookie.parse(socket.handshake.headers.cookie);
          jwtToken = cookies.admin_token;
        }
        if (!jwtToken) {
          socket.emit('authenticated', { success: false, error: 'Admin authentication failed' });
          socket.disconnect();
          return;
        }
        try {
          const decoded = jwt.verify(jwtToken, JWT_SECRET);
          if (decoded.role !== 'admin') {
            socket.emit('authenticated', { success: false, error: 'Admin authentication failed' });
            socket.disconnect();
            return;
          }
        } catch {
          socket.emit('authenticated', { success: false, error: 'Admin authentication failed' });
          socket.disconnect();
          return;
        }
        socket.join('admins');
        connectedAdmins.set(socket.id, { role: 'admin', authenticatedAt: Date.now() });
        socket.emit('authenticated', { success: true, role: 'admin' });
        console.log(`[Socket] Admin authenticated on socket ${socket.id}`);
        return;
      }

      if (!judgeId || !eventId) {
        socket.emit('authenticated', { success: false, error: 'judgeId and eventId required' });
        return;
      }

      const db = getDb();
      const judge = db
        .prepare('SELECT id, event_id, seat_number, name FROM judges WHERE id = ? AND event_id = ?')
        .get(judgeId, eventId);

      if (!judge) {
        socket.emit('authenticated', { success: false, error: 'Invalid judge credentials' });
        socket.disconnect();
        return;
      }

      connectedJudges.set(socket.id, {
        judgeId: judge.id,
        eventId: judge.event_id,
        lastHeartbeat: Date.now(),
      });

      socket.emit('authenticated', {
        success: true,
        role: 'judge',
        judge: { id: judge.id, seat_number: judge.seat_number, name: judge.name },
      });

      console.log(`[Socket] Judge ${judge.name} (Seat #${judge.seat_number}) authenticated on socket ${socket.id}`);
    });

    // --- Heartbeat ---
    socket.on('heartbeat', () => {
      const conn = connectedJudges.get(socket.id);
      if (conn) {
        conn.lastHeartbeat = Date.now();
      }
      socket.emit('heartbeat_ack', { timestamp: Date.now() });
    });

    // --- Score Update (real-time broadcast, also saved via REST) ---
    socket.on('score_update', (data) => {
      // Verify socket is authenticated
      const conn = connectedJudges.get(socket.id);
      if (!conn) {
        return; // Ignore unauthenticated sockets
      }

      const { judgeId, contestantId, criteriaId, categoryId, score } = data;

      // Verify the judgeId matches the authenticated socket
      if (conn.judgeId !== judgeId) {
        return; // Judge trying to submit scores for another judge
      }

      if (!contestantId || !criteriaId || !categoryId || score == null) {
        return;
      }
      // No broadcast here — the REST POST /api/scores endpoint handles broadcasting.
    });

    // --- Category Submission ---
    socket.on('category_submit', (data) => {
      // Verify socket is authenticated
      const conn = connectedJudges.get(socket.id);
      if (!conn) {
        return; // Ignore unauthenticated sockets
      }

      const { judgeId, categoryId } = data;

      if (!judgeId || !categoryId) return;

      // Verify judgeId matches authenticated judge
      if (conn.judgeId !== judgeId) {
        return; // Judge trying to submit for another judge
      }

      // Broadcast updated progress (category_submitted is emitted by the REST endpoint)
      const eventId = conn.eventId;
      if (eventId) {
        broadcastJudgeProgress(io, judgeId, eventId, categoryId);
      }
    });

    // --- Disconnect ---
    socket.on('disconnect', () => {
      connectedJudges.delete(socket.id);
      connectedAdmins.delete(socket.id);
      console.log(`[Socket] Disconnected: ${socket.id}`);
    });
  });

  // --- Heartbeat monitor: disconnect judges who stop sending heartbeats ---
  heartbeatIntervalId = setInterval(() => {
    const now = Date.now();
    for (const [socketId, conn] of connectedJudges.entries()) {
      if (now - conn.lastHeartbeat > HEARTBEAT_TIMEOUT_MS) {
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit('connection_lost', { reason: 'heartbeat_timeout' });
          // Disconnect after notifying — the 'disconnect' handler will clean up connectedJudges
          socket.disconnect(true);
        } else {
          // Socket object is gone but entry is still in map — remove it
          connectedJudges.delete(socketId);
        }
      }
    }
  }, 5000);
}

/**
 * Cleanup function for socket handlers - clears heartbeat interval
 */
export function cleanupSocketHandlers() {
  if (heartbeatIntervalId) {
    clearInterval(heartbeatIntervalId);
    heartbeatIntervalId = null;
  }
  connectedJudges.clear();
  connectedAdmins.clear();
}

/**
 * Helper: notify a specific judge that their sheet was unlocked.
 */
export function notifySheetUnlocked(io, judgeId, categoryId) {
  const judgeIdNum = Number(judgeId);
  for (const [socketId, conn] of connectedJudges.entries()) {
    if (conn.judgeId === judgeIdNum) {
      io.to(socketId).emit('sheet_unlocked', { judgeId, categoryId });
      break;
    }
  }
}

/**
 * Helper: broadcast that a category was locked/unlocked.
 */
export function broadcastCategoryLock(io, categoryId, isLocked) {
  io.emit('category_locked', { categoryId, isLocked });
}

/**
 * Helper: broadcast that a contestant was added.
 */
export function broadcastContestantAdded(io, contestant) {
  io.emit('contestant_added', { contestant });
}

/**
 * Broadcast to all connected sockets that the eligible contestant list for a
 * specific category has changed. Judges currently viewing that category should
 * reload their score sheet.
 *
 * @param {import('socket.io').Server} io
 * @param {number} categoryId
 * @param {number|null} requiredRoundId  The new round ID, or null if no filtering
 */
export function broadcastContestantsUpdated(io, categoryId, requiredRoundId) {
  io.emit('contestants_updated', { categoryId, requiredRoundId });
}
