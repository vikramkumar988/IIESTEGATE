const pool = require('./config/db');

async function migrate() {
  try {
    console.log('🔧 Running schema migration v2...\n');

    // Add employee_id column to users
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50)`);
    console.log('✅ Added employee_id column to users');

    // Add profile_photo column to users (ensure it exists)
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo VARCHAR(255)`);
    console.log('✅ Added profile_photo column to users');

    console.log('\n🎉 Migration v2 complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    process.exit(1);
  }
}

migrate();
