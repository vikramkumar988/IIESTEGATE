const express = require('express');
const { getStaffHistory } = require('./controllers/visitController');
const pool = require('./config/db');

async function debugDate() {
  // Update one record's updated_at to exactly today (April 7th, UTC equivalent of Indian evening)
  const todayDate = new Date();
  await pool.query("UPDATE visit_requests SET updated_at = $1 WHERE status = 'approved' OR status = 'expired' LIMIT 1", [todayDate]);
  
  // Fake request object
  const req = {
    user: { id: 1 }, // we need a valid staff ID. Let's find one.
    query: {
      date_from: '2026-04-07',
      date_to: '2026-04-07'
    }
  };
  
  const staff = await pool.query("SELECT staff_id FROM visit_requests LIMIT 1");
  req.user.id = staff.rows[0].staff_id;

  const res = {
    json: (data) => console.log(JSON.stringify(data, null, 2)),
    status: () => res
  };

  await getStaffHistory(req, res, console.error);
  await pool.end();
}

debugDate();
