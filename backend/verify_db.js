const pool = require('./config/db');
const bcrypt = require('bcryptjs');

async function check() {
  const admin = await pool.query("SELECT * FROM users WHERE email = 'admin@iiest.ac.in'");
  const guard = await pool.query("SELECT * FROM users WHERE email = 'guard1@iiest.ac.in'");
  console.log("Admin:", admin.rows[0]);
  console.log("Guard:", guard.rows[0]);
  
  // also check if 'admin123' works for admin
  if (admin.rows.length > 0) {
    const isMatch = await bcrypt.compare('admin123', admin.rows[0].password_hash);
    console.log("Does admin123 match 'admin@iiest.ac.in'? ", isMatch);
  }
  process.exit(0);
}

check();
