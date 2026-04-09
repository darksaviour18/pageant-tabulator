import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { initDatabase, closeDb } from './db/init.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// --- Health Check ---
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// --- Placeholder Routes (to be implemented in subsequent phases) ---
// Events, Judges, Contestants, Categories, Scores, Submissions, Reports

// --- Error Handling Middleware ---
app.use((err, _req, res, _next) => {
  console.error('[Express Error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// --- Socket.io Connection Handler ---
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
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
