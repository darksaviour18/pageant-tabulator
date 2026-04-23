/**
 * Database backup script
 * 
 * Creates a timestamped backup of the SQLite database including WAL files.
 * Run manually: npm run backup
 * Or via cron: crontab -e -> 0 */6 * * * cd /path/to && node server/scripts/backup.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const BACKUP_DIR = path.join(__dirname, '..', 'backups');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const dbName = 'pageant.db';

function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupName = `pageant-${timestamp}`;
  const backupPath = path.join(BACKUP_DIR, backupName);

  fs.mkdirSync(backupPath, { recursive: true });

  // Copy main database file
  const dbSrc = path.join(DATA_DIR, dbName);
  const dbDest = path.join(backupPath, dbName);
  
  if (fs.existsSync(dbSrc)) {
    fs.copyFileSync(dbSrc, dbDest);
    console.log(`[Backup] Copied ${dbName}`);
  }

  // Copy WAL file if exists
  const walSrc = path.join(DATA_DIR, `${dbName}-wal`);
  const walDest = path.join(backupPath, `${dbName}-wal`);
  
  if (fs.existsSync(walSrc)) {
    fs.copyFileSync(walSrc, walDest);
    console.log(`[Backup] Copied ${dbName}-wal`);
  }

  // Copy SHM file if exists
  const shmSrc = path.join(DATA_DIR, `${dbName}-shm`);
  const shmDest = path.join(backupPath, `${dbName}-shm`);
  
  if (fs.existsSync(shmSrc)) {
    fs.copyFileSync(shmSrc, shmDest);
    console.log(`[Backup] Copied ${dbName}-shm`);
  }

  console.log(`[Backup] Created: ${backupName}`);
  
  // Clean up old backups (keep last 10)
  cleanupOldBackups(10);
  
  return backupPath;
}

function cleanupOldBackups(keepCount) {
  const backups = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('pageant-'))
    .sort()
    .reverse();
  
  if (backups.length <= keepCount) return;
  
  const toDelete = backups.slice(keepCount);
  for (const dir of toDelete) {
    const fullPath = path.join(BACKUP_DIR, dir);
    fs.rmSync(fullPath, { recursive: true, force: true });
    console.log(`[Backup] Cleaned up: ${dir}`);
  }
}

// Run if executed directly
if (process.argv[1] === import.meta.url) {
  createBackup();
}

export { createBackup };