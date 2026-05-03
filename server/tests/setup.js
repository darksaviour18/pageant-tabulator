import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Set up a test database by initializing the real schema in a temp directory.
 */
export async function setupTestDb() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pageant-test-'));
  const dbPath = path.join(tempDir, 'test.db');

  process.env.DB_PATH = dbPath;
  process.env.DB_DIR = tempDir;
  process.env.ADMIN_SECRET = 'test-admin-secret';
  process.env.JWT_SECRET = 'test-jwt-secret';

  const { initDatabase, closeDb } = await import('../src/db/init.js');
  const db = initDatabase();

  const { default: express } = await import('express');
  const app = express();
  app.use(express.json());

  const mockIo = { to: () => mockIo, emit: () => {}, get: () => mockIo };
  app.set('io', mockIo);

  // Import and mount all routers matching server.js
  const allRoutes = await Promise.all([
    import('../src/routes/events.js'),
    import('../src/routes/judges.js'),
    import('../src/routes/contestants.js'),
    import('../src/routes/categories.js'),
    import('../src/routes/criteria.js'),
    import('../src/routes/criteriaById.js'),
    import('../src/routes/scores.js'),
    import('../src/routes/submissions.js'),
    import('../src/routes/scoring.js'),
    import('../src/routes/reports.js'),
    import('../src/routes/adminAuth.js'),
    import('../src/routes/eliminationRounds.js'),
    import('../src/routes/auditLogs.js'),
  ]);

  const [eventsR, judgesR, contestantsR, categoriesR, criteriaR, criteriaByIdR,
    scoresR, submissionsR, scoringR, reportsR, adminAuthR, eliminationRoundsR, auditLogsR] = allRoutes;

  app.use('/api/events', eventsR.default);
  app.use('/api/events/:eventId/judges', judgesR.default);
  app.use('/api/events/:eventId/contestants', contestantsR.default);
  app.use('/api/events/:eventId/categories', categoriesR.default);
  app.use('/api/events/:eventId/categories/:categoryId/criteria', criteriaR.default);
  app.use('/api/categories/:categoryId/criteria', criteriaR.default);
  app.use('/api/contestants', contestantsR.default);
  app.use('/api/criteria', criteriaByIdR.default);
  app.use('/api/scoring', scoringR.default);
  app.use('/api/scores', scoresR.default);
  app.use('/api/submissions', submissionsR.default);
  app.use('/api/reports', reportsR.default);
  app.use('/api/auth/admin', adminAuthR.default);
  app.use('/api/elimination-rounds', eliminationRoundsR.default);
  app.use('/api/audit-logs', auditLogsR.default);

  // Judge auth route (inline, mirrors server.js)
  const { authService } = await import('../src/services/authService.js');
  const { eventsService } = await import('../src/services/eventsService.js');
  const { signJudgeToken } = await import('../src/routes/adminAuth.js');

  app.post('/api/auth/judge', async (req, res) => {
    const { event_id, seat_number, pin } = req.body;
    if (!event_id || !seat_number || !pin) {
      return res.status(400).json({ error: 'event_id, seat_number, and pin are required' });
    }
    const event = eventsService.getById(event_id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (event.status !== 'active') return res.status(403).json({ error: 'Event archived' });
    const judge = await authService.authenticateJudge(event_id, seat_number, pin);
    if (!judge) return res.status(401).json({ error: 'Invalid credentials' });
    const token = signJudgeToken(judge.id);
    return res.json({ judge, event: { id: event.id, name: event.name, status: event.status }, token });
  });

  return { db, app, closeDb, tempDir };
}

/**
 * Clean up test database and temp directory.
 */
export function teardownTestDb(closeDb, tempDir) {
  closeDb();
  if (tempDir && fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  delete process.env.DB_PATH;
  delete process.env.DB_DIR;
  delete process.env.ADMIN_SECRET;
  delete process.env.JWT_SECRET;
}
