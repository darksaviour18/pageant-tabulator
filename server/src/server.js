import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { initDatabase, closeDb } from './db/init.js';
import eventsRouter from './routes/events.js';
import judgesRouter from './routes/judges.js';
import contestantsRouter from './routes/contestants.js';
import categoriesRouter from './routes/categories.js';
import criteriaRouter from './routes/criteria.js';
import criteriaByIdRouter from './routes/criteriaById.js';
import { authService } from './services/authService.js';
import { eventsService } from './services/eventsService.js';
import scoringRouter from './routes/scoring.js';
import scoresRouter from './routes/scores.js';
import submissionsRouter from './routes/submissions.js';
import reportsRouter from './routes/reports.js';
import adminAuthRouter from './routes/adminAuth.js';
import eliminationRoundsRouter from './routes/eliminationRounds.js';
import auditLogsRouter from './routes/auditLogs.js';
import { setupSocketHandlers } from './socket.js';

// 11.1.4: Rate limiter for judge auth (5 attempts per 30s per event+seat)
const authAttempts = new Map(); // key: "eventId:seatNumber" → { count, resetAt }
const AUTH_MAX_ATTEMPTS = 5;
const AUTH_WINDOW_MS = 30000;

function checkAuthRateLimit(eventId, seatNumber) {
  const key = `${eventId}:${seatNumber}`;
  const now = Date.now();
  const entry = authAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    authAttempts.set(key, { count: 1, resetAt: now + AUTH_WINDOW_MS });
    return { allowed: true };
  }
  entry.count++;
  if (entry.count > AUTH_MAX_ATTEMPTS) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { allowed: true };
}

function recordAuthAttempt(eventId, seatNumber, success) {
  const key = `${eventId}:${seatNumber}`;
  if (success) {
    authAttempts.delete(key);
  }
}

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, _res, next) => {
  const start = Date.now();
  _res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[HTTP] ${req.method} ${req.originalUrl} ${_res.statusCode} ${duration}ms`);
  });
  next();
});

// --- Socket.io Setup ---
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// --- Database Init ---
const db = initDatabase();
app.set('db', db);
app.set('io', io);

// --- Socket.io Event Handlers ---
setupSocketHandlers(io, app);

// --- Health Check ---
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// --- API Routes ---
app.use('/api/events', eventsRouter);
app.use('/api/events/:eventId/judges', judgesRouter);
app.use('/api/events/:eventId/contestants', contestantsRouter);
app.use('/api/events/:eventId/categories', categoriesRouter);
app.use('/api/events/:eventId/categories/:categoryId/criteria', criteriaRouter);
app.use('/api/categories/:categoryId/criteria', criteriaRouter);
app.use('/api/contestants', contestantsRouter);
app.use('/api/criteria', criteriaByIdRouter);
app.use('/api/scoring', scoringRouter);
app.use('/api/scores', scoresRouter);
app.use('/api/submissions', submissionsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/auth/admin', adminAuthRouter);
app.use('/api/elimination-rounds', eliminationRoundsRouter);
app.use('/api/audit-logs', auditLogsRouter);

// --- Judge Auth Route (direct mount to avoid Express 5 Router issue) ---
app.post('/api/auth/judge', async (req, res, next) => {
  const { event_id, seat_number, pin } = req.body;

  if (!event_id || !seat_number || !pin) {
    return res.status(400).json({ error: 'event_id, seat_number, and pin are required' });
  }
  if (typeof event_id !== 'number' || event_id < 1) {
    return res.status(400).json({ error: 'event_id must be a positive integer' });
  }
  if (typeof seat_number !== 'number' || seat_number < 1) {
    return res.status(400).json({ error: 'seat_number must be a positive integer' });
  }
  if (typeof pin !== 'string' || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    return res.status(400).json({ error: 'pin must be exactly 4 digits' });
  }

  // 11.1.4: Rate limiting
  const rateCheck = checkAuthRateLimit(event_id, seat_number);
  if (!rateCheck.allowed) {
    return res.status(429).json({ error: `Too many failed attempts. Try again in ${rateCheck.retryAfter}s` });
  }

  try {
    const event = eventsService.getById(event_id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    if (event.status !== 'active') {
      return res.status(403).json({ error: 'This event is archived and no longer accepting scores' });
    }

    const judge = await authService.authenticateJudge(event_id, seat_number, pin);
    if (!judge) {
      recordAuthAttempt(event_id, seat_number, false);
      return res.status(401).json({ error: 'Invalid seat number or PIN' });
    }

    recordAuthAttempt(event_id, seat_number, true);

    return res.json({
      judge,
      event: { id: event.id, name: event.name, status: event.status },
    });
  } catch (err) {
    next(err);
  }
});

// --- Error Handling Middleware ---
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[Express Error]', err.message);
  return res.status(500).json({ error: 'Internal server error' });
});

// --- Server Start ---
httpServer.listen(PORT, () => {
  console.log(`[Server] Running on port ${PORT}`);
  console.log(`[Server] Health check: http://localhost:${PORT}/api/health`);
});

// --- Graceful Shutdown ---
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down...');
  io.close();
  httpServer.close(() => {
    closeDb();
    console.log('[Server] Database closed. Exiting.');
    process.exit(0);
  });
});

export { app, io, httpServer };
