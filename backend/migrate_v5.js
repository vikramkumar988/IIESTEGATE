// migrate_v5.js — Pre-Registration System
// Run once: node migrate_v5.js

const pool = require('./config/db');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running migration v5: Pre-Registration System...\n');

    // 1. Create pre_registrations table
    console.log('1. Creating pre_registrations table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS pre_registrations (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        visitor_id      UUID NOT NULL REFERENCES visitors(id) ON DELETE CASCADE,
        staff_id        UUID NOT NULL REFERENCES users(id),
        purpose         TEXT NOT NULL,
        scheduled_date  DATE NOT NULL,
        scheduled_time  VARCHAR(10),
        status          VARCHAR(20) DEFAULT 'pending'
                        CHECK (status IN ('pending','approved','rejected','expired','completed')),
        reject_reason   TEXT,
        approval_message TEXT,
        notes           TEXT,
        visit_request_id UUID REFERENCES visit_requests(id),
        gate_pass_id    UUID REFERENCES gate_passes(id),
        approved_at     TIMESTAMP,
        valid_until     TIMESTAMP,
        created_at      TIMESTAMP DEFAULT NOW(),
        updated_at      TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('   ✅ pre_registrations table created\n');

    // 2. Create indexes
    console.log('2. Creating indexes...');
    await client.query(`CREATE INDEX IF NOT EXISTS idx_pre_reg_status ON pre_registrations(status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_pre_reg_staff ON pre_registrations(staff_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_pre_reg_date ON pre_registrations(scheduled_date);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_pre_reg_visitor ON pre_registrations(visitor_id);`);
    console.log('   ✅ Indexes created\n');

    console.log('========================================');
    console.log('✅ Migration v5 completed successfully!');
    console.log('========================================');
  } catch (err) {
    console.error('❌ Migration v5 failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
