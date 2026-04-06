// migrate_v3.js — Adds meeting confirmation columns to visit_requests
// Run once: node migrate_v3.js

const pool = require('./config/db');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running migration v3: adding meeting_status columns...');

    await client.query(`
      ALTER TABLE visit_requests
        ADD COLUMN IF NOT EXISTS meeting_status VARCHAR(20) DEFAULT 'not_confirmed'
          CHECK (meeting_status IN ('not_confirmed', 'met', 'not_met')),
        ADD COLUMN IF NOT EXISTS meeting_confirmed_at TIMESTAMP;
    `);

    console.log('✅ Migration v3 completed successfully.');
  } catch (err) {
    console.error('❌ Migration v3 failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
