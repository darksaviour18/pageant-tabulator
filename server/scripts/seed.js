import { getDb } from '../src/db/init.js';
import bcrypt from 'bcrypt';

const db = getDb();

console.log('[Seed] Starting...');

// Clear all tables in correct order
db.prepare('DELETE FROM scores').run();
db.prepare('DELETE FROM category_submissions').run();
db.prepare('DELETE FROM round_qualifiers').run();
db.prepare('DELETE FROM elimination_rounds').run();
db.prepare('DELETE FROM criteria').run();
db.prepare('DELETE FROM categories').run();
db.prepare('DELETE FROM contestants').run();
db.prepare('DELETE FROM judges').run();
db.prepare('DELETE FROM saved_reports').run();
db.prepare('DELETE FROM audit_log').run();
db.prepare('DELETE FROM events').run();

console.log('[Seed] Cleared all tables');

// Create event
const eventResult = db.prepare('INSERT INTO events (name, status, tabulators) VALUES (?, ?, ?)').run(
  'Miss Terybox 2026', 
  'active', 
  JSON.stringify([{name:'BEETHOVEN ETOL'}, {name:'CLAUDETTE LAROA'}])
);
const eventId = eventResult.lastInsertRowid;
console.log('[Seed] Created event:', eventId);

// Create judges
const judges = [
  { seat_number: 1, name: 'Judge 1', pin: '1234' },
  { seat_number: 2, name: 'Judge 2', pin: '2345' },
  { seat_number: 3, name: 'Judge 3', pin: '3456' },
  { seat_number: 4, name: 'Judge 4', pin: '4567' },
  { seat_number: 5, name: 'Judge 5', pin: '5678' },
];
for (const j of judges) {
  const hash = await bcrypt.hash(j.pin, 10);
  db.prepare('INSERT INTO judges (event_id, seat_number, name, pin_hash) VALUES (?, ?, ?, ?)').run(
    eventId, j.seat_number, j.name, hash
  );
  console.log(`[Seed] Created judge: ${j.name} (PIN: ${j.pin})`);
}

// Create contestants
for (let i = 1; i <= 5; i++) {
  db.prepare('INSERT INTO contestants (event_id, number, name, status) VALUES (?, ?, ?, ?)').run(
    eventId, i, 'Contestant ' + i, 'active'
  );
  console.log(`[Seed] Created contestant: ${i}`);
}

// Create categories and criteria
const categories = [
  { name: 'Preliminary Round', display_order: 1, criteria: [
    { name: 'Poise', weight: 0.4, min_score: 1, max_score: 10, display_order: 1 },
    { name: 'Beauty', weight: 0.3, min_score: 1, max_score: 10, display_order: 2 },
    { name: 'Confidence', weight: 0.3, min_score: 1, max_score: 10, display_order: 3 },
  ]},
  { name: 'Finals', display_order: 2, criteria: [
    { name: 'Evening Gown', weight: 0.4, min_score: 1, max_score: 10, display_order: 1 },
    { name: 'Q&A', weight: 0.6, min_score: 1, max_score: 10, display_order: 2 },
  ]},
];

for (const cat of categories) {
  const catResult = db.prepare('INSERT INTO categories (event_id, name, display_order, is_locked) VALUES (?, ?, ?, ?)').run(
    eventId, cat.name, cat.display_order, 0
  );
  const catId = catResult.lastInsertRowid;
  console.log(`[Seed] Created category: ${cat.name}`);
  
  for (const crit of cat.criteria) {
    db.prepare('INSERT INTO criteria (category_id, name, weight, min_score, max_score, display_order) VALUES (?, ?, ?, ?, ?, ?)').run(
      catId, crit.name, crit.weight, crit.min_score, crit.max_score, crit.display_order
    );
    console.log(`[Seed]   - Criteria: ${crit.name} (${crit.weight * 100}%, ${crit.min_score}-${crit.max_score})`);
  }
}

console.log('\n[Seed] DONE - Database rebuilt successfully');
console.log('[Seed] Event: Miss Terybox 2026 (ID:', eventId, ')');
console.log('[Seed] Judges: 5 (PINs: 1234, 2345, 3456, 4567, 5678)');
console.log('[Seed] Contestants: 5');
console.log('[Seed] Categories: 2 (Preliminary Round, Finals)');