import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Allow override via env var (used in tests)
const DATA_DIR = process.env.DB_DIR || path.join(__dirname, '..', '..', 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'pageant.db');

/**
 * Singleton database instance.
 */
let dbInstance = null;

/**
 * Initialize and return a Better-SQLite3 database connection with WAL mode enabled.
 * Creates all tables and indexes per the SPEC.md schema if they don't exist.
 * Returns the existing singleton if already initialized.
 */
export function initDatabase() {
  if (dbInstance) return dbInstance;

  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  dbInstance = new Database(DB_PATH);

  // Enable WAL mode for better concurrent read/write performance
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');
  dbInstance.pragma('synchronous = NORMAL');

  // WAL checkpoint on startup - ensures any pending WAL writes are committed to main DB
  // This prevents data loss on unexpected server shutdown/crash
  try {
    dbInstance.pragma('wal_checkpoint(TRUNCATE)');
    console.log('[DB] WAL checkpoint completed on startup');
  } catch (err) {
    console.warn('[DB] WAL checkpoint skipped (new database):', err.message);
  }

  // Create tables
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'archived')),
      tabulators TEXT -- JSON array of tabulator names: [{name: "REYMOND ABELLA"}]
    );

    CREATE TABLE IF NOT EXISTS judges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      seat_number INTEGER NOT NULL,
      name TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      UNIQUE(event_id, seat_number)
    );

    CREATE TABLE IF NOT EXISTS contestants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      number INTEGER NOT NULL,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'withdrawn')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      UNIQUE(event_id, number)
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      weight REAL DEFAULT 1,
      display_order INTEGER NOT NULL,
      is_locked BOOLEAN DEFAULT 0,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS criteria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      weight REAL NOT NULL CHECK(weight >= 0 AND weight <= 1),
      min_score REAL NOT NULL DEFAULT 0,
      max_score REAL NOT NULL DEFAULT 10,
      display_order INTEGER NOT NULL,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      judge_id INTEGER NOT NULL,
      contestant_id INTEGER NOT NULL,
      criteria_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      score REAL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY (judge_id) REFERENCES judges(id) ON DELETE CASCADE,
      FOREIGN KEY (contestant_id) REFERENCES contestants(id) ON DELETE CASCADE,
      FOREIGN KEY (criteria_id) REFERENCES criteria(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
      UNIQUE(judge_id, contestant_id, criteria_id)
    );

    CREATE TABLE IF NOT EXISTS category_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      judge_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      submitted BOOLEAN DEFAULT 0,
      submitted_at DATETIME,
      unlocked_by_admin BOOLEAN DEFAULT 0,
      FOREIGN KEY (judge_id) REFERENCES judges(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
      UNIQUE(judge_id, category_id)
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      judge_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY (judge_id) REFERENCES judges(id) ON DELETE SET NULL
    );

    -- Enhanced Reports (v1.3)
    CREATE TABLE IF NOT EXISTS saved_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      report_type TEXT NOT NULL CHECK(report_type IN ('category_detail', 'cross_category', 'top_n')),
      report_title TEXT NOT NULL,
      configuration TEXT NOT NULL, -- JSON: { category_ids, aggregation_type, signature_type, etc. }
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS elimination_rounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      round_name TEXT NOT NULL,
      round_order INTEGER NOT NULL,
      contestant_count INTEGER NOT NULL,
      based_on_report_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY (based_on_report_id) REFERENCES saved_reports(id) ON DELETE SET NULL,
      UNIQUE(event_id, round_order)
    );

    CREATE TABLE IF NOT EXISTS round_qualifiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      round_id INTEGER NOT NULL,
      contestant_id INTEGER NOT NULL,
      qualified_rank INTEGER NOT NULL,
      FOREIGN KEY (round_id) REFERENCES elimination_rounds(id) ON DELETE CASCADE,
      FOREIGN KEY (contestant_id) REFERENCES contestants(id) ON DELETE CASCADE,
      UNIQUE(round_id, contestant_id)
    );
  `);

  // Create indexes
  dbInstance.exec(`
    CREATE INDEX IF NOT EXISTS idx_scores_judge ON scores(judge_id);
    CREATE INDEX IF NOT EXISTS idx_scores_contestant ON scores(contestant_id);
    CREATE INDEX IF NOT EXISTS idx_scores_category ON scores(category_id);
    CREATE INDEX IF NOT EXISTS idx_scores_judge_category ON scores(judge_id, category_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_event ON audit_log(event_id, timestamp);
  `);

  // 11.3.5: Migration: Add weight column to categories if not exists
  try {
    dbInstance.exec("ALTER TABLE categories ADD COLUMN weight REAL DEFAULT 1");
  } catch (err) {
    // Column may already exist (ignore error)
  }

  return dbInstance;
}

/**
 * Get the singleton database instance.
 */
export function getDb() {
  return initDatabase();
}

/**
 * Close the database connection.
 */
export function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
