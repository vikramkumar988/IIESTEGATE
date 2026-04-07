const pool = require('./config/db');
async function test() {
  try {
    const res = await pool.query("SELECT id, status, updated_at, created_at FROM visit_requests WHERE updated_at >= '2026-04-07'::date AND updated_at < ('2026-04-07'::date + interval '1 day')");
    console.log("TODAY:", res.rows.length);
    const all = await pool.query("SELECT id, status, updated_at AT TIME ZONE 'Asia/Kolkata' as updated_ist, updated_at, created_at FROM visit_requests ORDER BY created_at DESC LIMIT 5");
    console.log("ALL DB REC:", all.rows);
  } finally {
    await pool.end();
  }
}
test();
