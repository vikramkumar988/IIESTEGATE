/**
 * Migration v6: OTP Verifications Table
 * Stores OTP codes for email login and password reset
 */
const pool = require('./config/db');

async function migrate() {
  console.log('🔄 Running migration v6: OTP Verifications...\n');

  try {
    // Create OTP verifications table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS otp_verifications (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email           VARCHAR(255) NOT NULL,
        otp_hash        VARCHAR(255) NOT NULL,
        type            VARCHAR(20) NOT NULL CHECK (type IN ('login', 'reset')),
        expires_at      TIMESTAMP NOT NULL,
        used            BOOLEAN DEFAULT false,
        attempts        INTEGER DEFAULT 0,
        created_at      TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Created otp_verifications table');

    // Index for quick lookup
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_otp_email_type ON otp_verifications(email, type, used);
    `);
    console.log('✅ Created index on otp_verifications');

    // Cleanup function: auto-delete expired OTPs older than 1 hour
    await pool.query(`
      DELETE FROM otp_verifications WHERE expires_at < NOW() - INTERVAL '1 hour';
    `);
    console.log('✅ Cleaned up old expired OTPs');

    console.log('\n✅ Migration v6 complete!');
  } catch (error) {
    console.error('❌ Migration v6 failed:', error.message);
  } finally {
    await pool.end();
  }
}

migrate();
