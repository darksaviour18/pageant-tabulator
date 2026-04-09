import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Set up a test database by initializing the real schema in a temp directory.
 * Returns { db, tempDir, createApp } where createApp() returns the Express test app.
 */
export async function setupTestDb() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pageant-test-'));
  const dbPath = path.join(tempDir, 'test.db');

  process.env.DB_PATH = dbPath;
  process.env.DB_DIR = tempDir;

  const { initDatabase, closeDb } = await import('../src/db/init.js');
  const db = initDatabase();

  const { default: express } = await import('express');
  const app = express();
  app.use(express.json());

  // Mock io for socket broadcasts
  const mockIo = { to: () => mockIo, emit: () => {} };
  app.set('io', mockIo);

  // Import and mount all routers
  const routes = await Promise.all([
    import('../src/routes/events.js'),
    import('../src/routes/judges.js'),
    import('../src/routes/contestants.js'),
    import('../src/routes/categories.js'),
    import('../src/routes/criteria.js'),
    import('../src/routes/scores.js'),
    import('../src/routes/submissions.js'),
    import('../src/routes/scoring.js'),
    import('../src/routes/reports.js'),
  ]);

  const [eventsR, judgesR, contestantsR, categoriesR, criteriaR, scoresR, submissionsR, scoringR, reportsR] = routes;

  app.use('/api/events', eventsR.default);
  app.use('/api/events/:eventId/judges', judgesR.default);
  app.use('/api/events/:eventId/contestants', contestantsR.default);
  app.use('/api/events/:eventId/categories', categoriesR.default);
  app.use('/api/categories/:categoryId/criteria', criteriaR.default);
  app.use('/api/scores', scoresR.default);
  app.use('/api/submissions', submissionsR.default);
  app.use('/api/scoring', scoringR.default);
  app.use('/api/reports', reportsR.default);

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
}
