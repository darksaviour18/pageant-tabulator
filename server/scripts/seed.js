import { getDb } from '../src/db/init.js';

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
  'Miss Pageant 2026', 
  'active', 
  JSON.stringify([{name:'Beethoven Etol'}, {name:'Claudette Laroa'}])
);
const eventId = eventResult.lastInsertRowid;
console.log('[Seed] Created event:', eventId);

// Create judges
const judges = [
  { seat_number: 1, name: 'Maria Santos', pin: '1234' },
  { seat_number: 2, name: 'Juan Reyes', pin: '2345' },
  { seat_number: 3, name: 'Ana Cruz', pin: '3456' },
  { seat_number: 4, name: 'Pedro Lopez', pin: '4567' },
  { seat_number: 5, name: 'Carmen Wang', pin: '5678' },
];
for (const j of judges) {
  db.prepare('INSERT INTO judges (event_id, seat_number, name, pin) VALUES (?, ?, ?, ?)').run(
    eventId, j.seat_number, j.name, j.pin
  );
  console.log(`[Seed] Created judge: ${j.name} (PIN: ${j.pin})`);
}

// Create contestants
const contestants = [
  'Sophia Reyes',
  'Mia Torres',
  'Olivia Garcia',
  'Emma Santos',
  'Isabella Cruz',
  'Sofia Martinez',
  'Camila Lopez',
  'Natalia Rivera',
  'Victoria Chen',
  'Antonette De Vera',
];
for (let i = 0; i < contestants.length; i++) {
  db.prepare('INSERT INTO contestants (event_id, number, name, status) VALUES (?, ?, ?, ?)').run(
    eventId, i + 1, contestants[i], 'active'
  );
  console.log(`[Seed] Created contestant: ${i + 1}. ${contestants[i]}`);
}

// Create categories and criteria
const categories = [
  { 
    name: 'Pre-judging', 
    display_order: 1, 
    criteria: [
      { name: 'Poise', weight: 0.30, min_score: 1, max_score: 10, display_order: 1 },
      { name: 'Presence', weight: 0.40, min_score: 1, max_score: 10, display_order: 2 },
      { name: 'Stage Presence', weight: 0.30, min_score: 1, max_score: 10, display_order: 3 },
    ]
  },
  { 
    name: 'Production Number', 
    display_order: 2, 
    criteria: [
      { name: 'Choreography', weight: 0.33, min_score: 1, max_score: 10, display_order: 1 },
      { name: 'Energy', weight: 0.33, min_score: 1, max_score: 10, display_order: 2 },
      { name: 'Crowd Appeal', weight: 0.34, min_score: 1, max_score: 10, display_order: 3 },
    ]
  },
  { 
    name: 'Swimwear', 
    display_order: 3, 
    criteria: [
      { name: 'Poise', weight: 0.35, min_score: 1, max_score: 10, display_order: 1 },
      { name: 'Physique', weight: 0.35, min_score: 1, max_score: 10, display_order: 2 },
      { name: 'Confidence', weight: 0.30, min_score: 1, max_score: 10, display_order: 3 },
    ]
  },
  { 
    name: 'Evening Gown', 
    display_order: 4, 
    criteria: [
      { name: 'Elegance', weight: 0.40, min_score: 1, max_score: 10, display_order: 1 },
      { name: 'Poise', weight: 0.30, min_score: 1, max_score: 10, display_order: 2 },
      { name: 'Stage Presence', weight: 0.30, min_score: 1, max_score: 10, display_order: 3 },
    ]
  },
  { 
    name: 'Final Q&A', 
    display_order: 5, 
    criteria: [
      { name: 'Articulation', weight: 0.33, min_score: 1, max_score: 10, display_order: 1 },
      { name: 'Creativity', weight: 0.33, min_score: 1, max_score: 10, display_order: 2 },
      { name: 'Confidence', weight: 0.34, min_score: 1, max_score: 10, display_order: 3 },
    ]
  },
];

const categoryIds = [];
for (const cat of categories) {
  const catResult = db.prepare('INSERT INTO categories (event_id, name, display_order, is_locked) VALUES (?, ?, ?, ?)').run(
    eventId, cat.name, cat.display_order, 0
  );
  const catId = catResult.lastInsertRowid;
  categoryIds.push(catId);
  console.log(`[Seed] Created category: ${cat.name}`);
  
  for (const crit of cat.criteria) {
    db.prepare('INSERT INTO criteria (category_id, name, weight, min_score, max_score, display_order) VALUES (?, ?, ?, ?, ?, ?)').run(
      catId, crit.name, crit.weight, crit.min_score, crit.max_score, crit.display_order
    );
    console.log(`[Seed]   - Criteria: ${crit.name} (${crit.weight * 100}%, ${crit.min_score}-${crit.max_score})`);
  }
}

// Get all judge IDs
const allJudges = db.prepare('SELECT id FROM judges WHERE event_id = ?').all(eventId);
const judgeIds = allJudges.map(j => j.id);

// Get all contestant IDs
const allContestants = db.prepare('SELECT id FROM contestants WHERE event_id = ?').all(eventId);
const contestantIds = allContestants.map(c => c.id);

// Get criteria IDs per category
const criteriaByCategory = {};
for (const catId of categoryIds) {
  const criteria = db.prepare('SELECT id FROM criteria WHERE category_id = ?').all(catId);
  criteriaByCategory[catId] = criteria.map(c => c.id);
}

// Generate sample scores for categories 1-4 (Pre-judging through Evening Gown)
// Categories 0-3 in our array (Pre-judging, Production Number, Swimwear, Evening Gown)
// Final Q&A is category 4 - will be scored after elimination
const scoringCategoryIndices = [0, 1, 2, 3];

// Random score generator between min and max
const randomScore = (min, max) => (Math.random() * (max - min) + min).toFixed(1);

console.log('\n[Seed] Generating sample scores...');

// Each judge scores each contestant in each criteria of categories 1-4
for (const judgeId of judgeIds) {
  for (const contestantId of contestantIds) {
    for (const catIndex of scoringCategoryIndices) {
      const catId = categoryIds[catIndex];
      const criteriaIds = criteriaByCategory[catId];
      
      for (const criteriaId of criteriaIds) {
        const score = parseFloat(randomScore(6.0, 9.5));
        db.prepare(`
          INSERT INTO scores (event_id, judge_id, contestant_id, criteria_id, category_id, score, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(eventId, judgeId, contestantId, criteriaId, catId, score);
      }
    }
  }
  console.log(`[Seed]   Judge ${judgeId}: Scored all contestants in ${scoringCategoryIndices.length} categories`);
}

console.log('[Seed] Sample scores generated for all judges in categories 1-4');

console.log('\n[Seed] ============================================');
console.log('[Seed] DONE - Database rebuilt successfully');
console.log('[Seed] ============================================');
console.log('[Seed] Event: Miss Pageant 2026 (ID:', eventId, ')');
console.log('[Seed] Judges: 5 (PINs: 1234, 2345, 3456, 4567, 5678)');
console.log('[Seed] Contestants: 10 (Sophia - Antonette)');
console.log('[Seed] Categories: 5');
console.log('[Seed]   1. Pre-judging (Poise, Presence, Stage Presence)');
console.log('[Seed]   2. Production Number (Choreography, Energy, Crowd Appeal)');
console.log('[Seed]   3. Swimwear (Poise, Physique, Confidence)');
console.log('[Seed]   4. Evening Gown (Elegance, Poise, Stage Presence)');
console.log('[Seed]   5. Final Q&A (Articulation, Creativity, Confidence)');
console.log('[Seed] Sample scores: All judges scored categories 1-4');
console.log('[Seed] Ready for: Cross-category report → Elimination round → Final Q&A');
