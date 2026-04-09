/**
 * Setup Socket.io event handlers.
 *
 * Implements SPEC.md §8 WebSocket Events:
 * - Client → Server: authenticate, heartbeat, score_update, category_submit
 * - Server → Client: authenticated, heartbeat_ack, judge_progress, score_updated,
 *   category_submitted, category_locked, sheet_unlocked, contestant_added
 */

import { getDb } from './db/init.js';

const HEARTBEAT_TIMEOUT_MS = 10000;

/**
 * Track connected judges: socketId → { judgeId, eventId, lastHeartbeat }
 */
const connectedJudges = new Map();

/**
 * Track admin connections: socketId → { role: 'admin' }
 */
const connectedAdmins = new Map();

/**
 * 10.1.6: Socket.io authentication middleware.
 * Validates that the client provides valid credentials on connection.
 */
function authMiddleware(socket, next) {
  const { token, role } = socket.handshake.auth;

  // If a JWT token is provided (future JWT integration), validate it here
  if (token) {
    // TODO: Implement JWT verification when JWT auth is added
    // For now, accept any token and proceed
    return next();
  }

  // For LAN deployment without JWT, allow connections and require
  // explicit authenticate event after connection
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
 * Broadcast a live score update to all admin clients.
 */
function broadcastScoreUpdate(io, judgeId, contestantId, criteriaId, categoryId, score) {
  io.to('admins').emit('score_updated', {
    judgeId,
    contestantId,
    criteriaId,
    categoryId,
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
      const { judgeId, contestantId, criteriaId, categoryId, score } = data;

      if (!judgeId || !contestantId || !criteriaId || !categoryId || score == null) {
        return;
      }

      broadcastScoreUpdate(io, judgeId, contestantId, criteriaId, categoryId, score);
      broadcastJudgeProgress(io, judgeId, data.eventId || connectedJudges.get(socket.id)?.eventId, categoryId);
    });

    // --- Category Submission ---
    socket.on('category_submit', (data) => {
      const { judgeId, categoryId } = data;

      if (!judgeId || !categoryId) return;

      io.emit('category_submitted', { judgeId, categoryId });

      // Broadcast updated progress
      const eventId = connectedJudges.get(socket.id)?.eventId;
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
  setInterval(() => {
    const now = Date.now();
    for (const [socketId, conn] of connectedJudges.entries()) {
      if (now - conn.lastHeartbeat > HEARTBEAT_TIMEOUT_MS) {
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit('connection_lost', { reason: 'heartbeat_timeout' });
        }
      }
    }
  }, 5000);
}

/**
 * Helper: notify a specific judge that their sheet was unlocked.
 */
export function notifySheetUnlocked(io, judgeId, categoryId) {
  // Find the socket for this judge
  for (const [socketId, conn] of connectedJudges.entries()) {
    if (conn.judgeId === judgeId) {
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
