const bcrypt = require('bcrypt');
const { getDb } = require('./src/db/init.js');

async function testAuth() {
  const db = getDb();
  
  // Get judge
  const judge = db.prepare('SELECT * FROM judges WHERE event_id = ? AND seat_number = ?').get(1, 1);
  console.log('Judge:', judge ? { id: judge.id, name: judge.name, seat: judge.seat_number } : null);
  
  if (!judge) {
    console.log('No judge found');
    return;
  }
  
  // Test bcrypt
  const valid = await bcrypt.compare('1234', judge.pin_hash);
  console.log('PIN 1234 valid:', valid);
  
  // Test with wrong PIN
  const invalid = await bcrypt.compare('9999', judge.pin_hash);
  console.log('PIN 9999 valid:', invalid);
}

testAuth().catch(console.error);
