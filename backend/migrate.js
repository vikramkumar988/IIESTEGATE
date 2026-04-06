const pool = require('./config/db');

async function migrate() {
  try {
    console.log('🔧 Running schema migration...\n');

    // 1. Add organization column to users
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS organization VARCHAR(50) DEFAULT 'iiest'`);
    console.log('✅ Added organization column to users');

    // 2. Add is_approved column to users
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false`);
    console.log('✅ Added is_approved column to users');

    // 3. Add approval_message column to visit_requests
    await pool.query(`ALTER TABLE visit_requests ADD COLUMN IF NOT EXISTS approval_message TEXT`);
    console.log('✅ Added approval_message column to visit_requests');

    // 4. Create activity_logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50),
        entity_id UUID,
        details JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Created activity_logs table');

    // 5. Create indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_users_approved ON users(is_approved)');
    console.log('✅ Created indexes');

    // 6. Set existing users to approved
    const updated = await pool.query('UPDATE users SET is_approved = true WHERE is_approved = false OR is_approved IS NULL');
    console.log(`✅ Set ${updated.rowCount} existing users to approved`);

    // 7. Set existing users organization to iiest
    const orgUpdated = await pool.query("UPDATE users SET organization = 'iiest' WHERE organization IS NULL");
    console.log(`✅ Set ${orgUpdated.rowCount} users organization to iiest`);

    // Verify
    console.log('\n📋 Verification:');
    const cols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position");
    console.log('Users columns:', cols.rows.map(x => x.column_name).join(', '));

    const actCols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'activity_logs' ORDER BY ordinal_position");
    console.log('Activity_logs columns:', actCols.rows.map(x => x.column_name).join(', '));

    const vrCols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'visit_requests' ORDER BY ordinal_position");
    console.log('Visit_requests columns:', vrCols.rows.map(x => x.column_name).join(', '));

    console.log('\n🎉 Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    process.exit(1);
  }
}

migrate();
