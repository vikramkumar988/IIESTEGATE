/**
 * Migration v7 — Visitor Journey Tracking & Enterprise Features
 * 
 * Adds:
 * - visitor_journeys table — tracks a visitor's full campus session
 * - journey_stops table — each stop in a multi-stop visit
 * - Referral columns on visit_requests
 * - Indexes for performance
 * 
 * Safe to run multiple times (all statements use IF NOT EXISTS).
 */

const pool = require('./config/db');

async function migrate() {
  console.log('🚀 Running migration v7 — Visitor Journey Tracking & Enterprise Features...\n');

  try {
    // ========== 1. VISITOR JOURNEYS TABLE ==========
    await pool.query(`
      CREATE TABLE IF NOT EXISTS visitor_journeys (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        visitor_id      UUID NOT NULL REFERENCES visitors(id),
        initial_pass_id UUID NOT NULL REFERENCES gate_passes(id),
        campus_entry    TIMESTAMP NOT NULL,
        campus_exit     TIMESTAMP,
        total_stops     INTEGER DEFAULT 1,
        status          VARCHAR(20) DEFAULT 'active'
                        CHECK (status IN ('active', 'completed', 'overstay')),
        created_at      TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ visitor_journeys table created');

    // ========== 2. JOURNEY STOPS TABLE ==========
    await pool.query(`
      CREATE TABLE IF NOT EXISTS journey_stops (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        journey_id       UUID NOT NULL REFERENCES visitor_journeys(id) ON DELETE CASCADE,
        stop_number      INTEGER NOT NULL,
        staff_id         UUID NOT NULL REFERENCES users(id),
        referred_by      UUID REFERENCES users(id),
        visit_request_id UUID REFERENCES visit_requests(id),
        gate_pass_id     UUID REFERENCES gate_passes(id),
        purpose          TEXT,
        status           VARCHAR(20) DEFAULT 'pending'
                         CHECK (status IN ('pending', 'approved', 'rejected', 'met', 'skipped')),
        arrived_at       TIMESTAMP,
        departed_at      TIMESTAMP,
        notes            TEXT,
        created_at       TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ journey_stops table created');

    // ========== 3. ALTER visit_requests — add referral columns ==========
    const alterStatements = [
      `ALTER TABLE visit_requests ADD COLUMN IF NOT EXISTS referred_by_staff UUID REFERENCES users(id)`,
      `ALTER TABLE visit_requests ADD COLUMN IF NOT EXISTS journey_id UUID`,
      `ALTER TABLE visit_requests ADD COLUMN IF NOT EXISTS parent_request_id UUID REFERENCES visit_requests(id)`,
    ];

    for (const stmt of alterStatements) {
      try {
        await pool.query(stmt);
      } catch (e) {
        // Column may already exist on older Postgres — ignore
        if (!e.message.includes('already exists')) {
          console.log(`  ⚠️ ${e.message}`);
        }
      }
    }
    console.log('✅ visit_requests referral columns added');

    // Add FK constraint for journey_id if not exists
    try {
      await pool.query(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'fk_visit_requests_journey'
          ) THEN
            ALTER TABLE visit_requests 
              ADD CONSTRAINT fk_visit_requests_journey 
              FOREIGN KEY (journey_id) REFERENCES visitor_journeys(id);
          END IF;
        END $$;
      `);
    } catch (e) {
      console.log('  ⚠️ journey FK:', e.message);
    }

    // ========== 4. INDEXES ==========
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_journeys_visitor ON visitor_journeys(visitor_id)`,
      `CREATE INDEX IF NOT EXISTS idx_journeys_status ON visitor_journeys(status) WHERE status = 'active'`,
      `CREATE INDEX IF NOT EXISTS idx_journeys_entry ON visitor_journeys(campus_entry DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_journey_stops_journey ON journey_stops(journey_id)`,
      `CREATE INDEX IF NOT EXISTS idx_journey_stops_staff ON journey_stops(staff_id)`,
      `CREATE INDEX IF NOT EXISTS idx_visit_requests_journey ON visit_requests(journey_id) WHERE journey_id IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_visit_requests_referred ON visit_requests(referred_by_staff) WHERE referred_by_staff IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_visit_requests_parent ON visit_requests(parent_request_id) WHERE parent_request_id IS NOT NULL`,
    ];

    for (const idx of indexes) {
      try {
        await pool.query(idx);
      } catch (e) {
        console.log(`  ⚠️ Index: ${e.message}`);
      }
    }
    console.log('✅ All indexes created');

    console.log('\n🎉 Migration v7 completed successfully!\n');
  } catch (error) {
    console.error('❌ Migration v7 failed:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

migrate();
