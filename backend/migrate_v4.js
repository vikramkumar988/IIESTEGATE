// migrate_v4.js — Comprehensive schema migration for full system upgrade
// Run once: node migrate_v4.js

const pool = require('./config/db');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running migration v4: Full system upgrade...\n');

    // 1. Fix entry_time — remove default NOW(), make nullable
    console.log('1. Fixing entry_time on gate_passes...');
    await client.query(`ALTER TABLE gate_passes ALTER COLUMN entry_time DROP DEFAULT;`);
    await client.query(`ALTER TABLE gate_passes ALTER COLUMN entry_time SET DEFAULT NULL;`);
    console.log('   ✅ entry_time fixed\n');

    // 2. Staff availability
    console.log('2. Adding staff availability columns...');
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS availability VARCHAR(20) DEFAULT 'available',
        ADD COLUMN IF NOT EXISTS availability_note TEXT,
        ADD COLUMN IF NOT EXISTS available_from TIMESTAMP;
    `);
    // Add check constraint if not exists (safe idempotent approach)
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD CONSTRAINT users_availability_check
          CHECK (availability IN ('available','in_meeting','on_leave','unavailable'));
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    console.log('   ✅ Staff availability columns added\n');

    // 3. Vehicle tracking for general visits
    console.log('3. Adding vehicle tracking to general_visits...');
    await client.query(`
      ALTER TABLE general_visits
        ADD COLUMN IF NOT EXISTS vehicle_number VARCHAR(20),
        ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(20) DEFAULT 'none',
        ADD COLUMN IF NOT EXISTS vehicle_photo_url TEXT;
    `);
    console.log('   ✅ Vehicle tracking columns added\n');

    // 4. Pre-visit request fields
    console.log('4. Adding pre-visit request fields...');
    await client.query(`
      ALTER TABLE visit_requests
        ADD COLUMN IF NOT EXISTS pre_visit BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS scheduled_date TIMESTAMP;
    `);
    await client.query(`
      ALTER TABLE visitors
        ADD COLUMN IF NOT EXISTS visitor_email VARCHAR(255);
    `);
    console.log('   ✅ Pre-visit fields added\n');

    // 5. ID card photo capture
    console.log('5. Adding ID card photo to visitors...');
    await client.query(`
      ALTER TABLE visitors ADD COLUMN IF NOT EXISTS id_card_photo_url TEXT;
    `);
    console.log('   ✅ ID card photo column added\n');

    // 6. SMS delivery tracking
    console.log('6. Adding SMS tracking to gate_passes...');
    await client.query(`
      ALTER TABLE gate_passes
        ADD COLUMN IF NOT EXISTS sms_sent BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS sms_sent_at TIMESTAMP;
    `);
    console.log('   ✅ SMS tracking columns added\n');

    // 7. Campus lockdowns table
    console.log('7. Creating campus_lockdowns table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS campus_lockdowns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        activated_by UUID NOT NULL REFERENCES users(id),
        reason TEXT NOT NULL,
        activated_at TIMESTAMP DEFAULT NOW(),
        lifted_at TIMESTAMP,
        is_active BOOLEAN DEFAULT true
      );
    `);
    console.log('   ✅ campus_lockdowns table created\n');

    // 8. Add indexes
    console.log('8. Creating performance indexes...');
    await client.query(`CREATE INDEX IF NOT EXISTS idx_gate_passes_entry_exit ON gate_passes(entry_time, exit_time) WHERE exit_time IS NULL;`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_general_visits_vehicle ON general_visits(vehicle_number);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_campus_lockdowns_active ON campus_lockdowns(is_active) WHERE is_active = true;`);
    console.log('   ✅ Indexes created\n');

    console.log('========================================');
    console.log('✅ Migration v4 completed successfully!');
    console.log('========================================');
  } catch (err) {
    console.error('❌ Migration v4 failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
