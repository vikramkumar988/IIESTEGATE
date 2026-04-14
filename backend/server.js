const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
require('dotenv').config();

const pool = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Auto-create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Created uploads directory');
}

// Auto-run schema on startup (all statements are CREATE IF NOT EXISTS — safe to run repeatedly)
(async () => {
  try {
    const schemaSQL = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(schemaSQL);
    console.log('✅ Database schema verified');

    // Auto-add employee_id column if missing (migration for existing databases)
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id VARCHAR(100)`);
    } catch (e) { /* column already exists or not supported — ignore */ }
  } catch (error) {
    console.error('⚠️ Schema init warning:', error.message);
  }
})();

// Import routes
const authRoutes = require('./routes/authRoutes');
const visitRoutes = require('./routes/visitRoutes');
const generalVisitRoutes = require('./routes/generalVisitRoutes');
const gatePassRoutes = require('./routes/gatePassRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const userRoutes = require('./routes/userRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const preRegRoutes = require('./routes/preRegRoutes');
const journeyRoutes = require('./routes/journeyRoutes');

const app = express();

// ===================== MIDDLEWARE =====================
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Serve uploaded photos as static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===================== ROUTES =====================
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'IIEST E-Gate Pass API is running 🚀', timestamp: new Date().toISOString() });
});

// Test SMS endpoint — for verifying SMS delivery
app.post('/api/test-sms', async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }
    const { sendPassSMS, sendNotificationSMS } = require('./utils/smsService');
    const testMessage = message || 'Hello from IIEST E-Gate Pass System! This is a test SMS. If you received this, SMS is working correctly.';
    
    // Try sending via pass SMS (which generates a pass URL) or notification SMS
    const result = await sendNotificationSMS(phone, testMessage);
    console.log('📱 Test SMS result:', JSON.stringify(result));
    
    res.json({
      success: result.success,
      message: result.success ? `Test SMS sent to ${phone}` : `SMS failed: ${result.message}`,
      data: result,
    });
  } catch (error) {
    console.error('Test SMS error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/general-visits', generalVisitRoutes);
app.use('/api/passes', gatePassRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/pre-register', preRegRoutes);
app.use('/api/journeys', require('./middleware/auth'), journeyRoutes);

// Public pass page (no auth — visitor accesses via SMS link)
const publicPassController = require('./controllers/publicPassController');
app.get('/pass/:pass_code', publicPassController.getPublicPass);

// Public pre-registration pages (no auth — visitor accesses via browser)
const preRegPagesController = require('./controllers/preRegPagesController');
app.get('/pre-register', preRegPagesController.renderFormPage);
app.get('/pre-register/success/:id', preRegPagesController.renderSuccessPage);
app.get('/pre-register/status/:id', preRegPagesController.renderStatusPage);

// ===================== AUTO-EXPIRY CRON JOB =====================
// Runs every minute to expire old passes + detect overstays
const { sendPushNotification } = require('./utils/pushNotification');

cron.schedule('* * * * *', async () => {
  try {
    // 1. Expire active gate passes past their valid_until
    const expired = await pool.query(
      `UPDATE gate_passes SET status = 'expired'
       WHERE status = 'active' AND valid_until < NOW()
       AND (entry_time IS NULL OR exit_time IS NOT NULL)
       RETURNING id`
    );

    // 1b. Also expire approved visit_requests whose valid_until has passed
    // (but NOT if the visitor is still inside campus — entry_time set, exit_time null)
    const expiredApproved = await pool.query(
      `UPDATE visit_requests SET status = 'expired', updated_at = NOW()
       WHERE status = 'approved' AND valid_until IS NOT NULL AND valid_until < NOW()
       AND id NOT IN (
         SELECT visit_request_id FROM gate_passes 
         WHERE entry_time IS NOT NULL AND exit_time IS NULL AND visit_request_id IS NOT NULL
       )
       RETURNING id`
    );

    // 2. Expire pending visit requests older than timeout
    const timeoutMinutes = parseInt(process.env.REQUEST_TIMEOUT_MINUTES) || 30;
    const expiredRequests = await pool.query(
      `UPDATE visit_requests SET status = 'expired', updated_at = NOW()
       WHERE status = 'pending' AND requested_at < NOW() - INTERVAL '${timeoutMinutes} minutes'
       RETURNING id`
    );

    // 3. Expire general visits past valid_until
    const expiredGeneral = await pool.query(
      `UPDATE general_visits SET status = 'expired'
       WHERE status = 'approved' AND valid_until < NOW()
       RETURNING id`
    );

    // 4. Expire pre-registrations past scheduled_date + 24 hours
    const expiredPreRegs = await pool.query(
      `UPDATE pre_registrations SET status = 'expired', updated_at = NOW()
       WHERE status IN ('pending', 'approved') AND scheduled_date < CURRENT_DATE - INTERVAL '1 day'
       RETURNING id`
    );

    const totalExpired = expired.rows.length + expiredApproved.rows.length + expiredRequests.rows.length + expiredGeneral.rows.length + (expiredPreRegs?.rows?.length || 0);
    if (totalExpired > 0) {
      console.log(`⏰ Auto-expired: ${expired.rows.length} passes, ${expiredApproved.rows.length} approved visits, ${expiredRequests.rows.length} pending requests, ${expiredGeneral.rows.length} general visits, ${expiredPreRegs?.rows?.length || 0} pre-registrations`);
    }

    // 4. OVERSTAY ALERT: visitors who entered but haven't exited and pass is now expired
    const overstayers = await pool.query(
      `SELECT gp.id, gp.entry_time, gp.valid_until, gp.pass_code,
              v.full_name as visitor_name, v.phone as visitor_phone
       FROM gate_passes gp
       JOIN visitors v ON gp.visitor_id = v.id
       WHERE gp.entry_time IS NOT NULL AND gp.exit_time IS NULL
         AND gp.valid_until < NOW()
         AND gp.status IN ('expired', 'active')
       LIMIT 20`
    );

    if (overstayers.rows.length > 0) {
      // Get all guard push tokens
      const guards = await pool.query(
        `SELECT id, push_token FROM users WHERE role = 'guard' AND is_active = true AND push_token IS NOT NULL`
      );

      for (const visitor of overstayers.rows) {
        const entryStr = new Date(visitor.entry_time).toLocaleTimeString('en-IN');
        const alertMsg = `⚠️ OVERSTAY: ${visitor.visitor_name} entered at ${entryStr} and has NOT exited. Pass expired at ${new Date(visitor.valid_until).toLocaleTimeString('en-IN')}.`;

        for (const guard of guards.rows) {
          try {
            await sendPushNotification(guard.push_token, '⚠️ Overstay Alert', alertMsg);
          } catch (e) { /* continue */ }
        }
      }
      console.log(`⚠️ Overstay alerts sent for ${overstayers.rows.length} visitors`);
    }
  } catch (error) {
    console.error('Cron job error:', error.message);
  }
});

// Midnight: reset 'in_meeting' availability back to 'available'
cron.schedule('0 0 * * *', async () => {
  try {
    const reset = await pool.query(
      `UPDATE users SET availability = 'available', availability_note = NULL, available_from = NULL
       WHERE availability = 'in_meeting' RETURNING id`
    );
    if (reset.rows.length > 0) {
      console.log(`🔄 Reset ${reset.rows.length} staff from 'in_meeting' to 'available'`);
    }
  } catch (error) {
    console.error('Midnight reset error:', error.message);
  }
});

// 8 PM Daily: headcount report for admins
cron.schedule('0 20 * * *', async () => {
  try {
    const stillInside = await pool.query(
      `SELECT v.full_name, gp.entry_time
       FROM gate_passes gp JOIN visitors v ON gp.visitor_id = v.id
       WHERE gp.entry_time IS NOT NULL AND gp.exit_time IS NULL
         AND DATE(gp.entry_time) = CURRENT_DATE`
    );

    const totalEntries = await pool.query(
      `SELECT COUNT(*) FROM gate_passes WHERE DATE(entry_time) = CURRENT_DATE AND entry_time IS NOT NULL`
    );
    const totalExits = await pool.query(
      `SELECT COUNT(*) FROM gate_passes WHERE DATE(exit_time) = CURRENT_DATE AND exit_time IS NOT NULL`
    );

    const entered = parseInt(totalEntries.rows[0].count);
    const exited = parseInt(totalExits.rows[0].count);
    const inside = stillInside.rows.length;

    let reportBody = `📊 Daily Report: ${entered} entered, ${exited} exited, ${inside} still inside.`;
    if (inside > 0) {
      const names = stillInside.rows.slice(0, 5).map(r => r.full_name).join(', ');
      reportBody += `\nStill inside: ${names}${inside > 5 ? ` and ${inside - 5} more` : ''}`;
    }

    // Send to all admins
    const admins = await pool.query(
      `SELECT id, push_token FROM users WHERE role = 'admin' AND is_active = true AND push_token IS NOT NULL`
    );
    for (const admin of admins.rows) {
      try {
        await sendPushNotification(admin.push_token, '📊 Daily Campus Report', reportBody);
      } catch (e) { /* continue */ }
      await pool.query(
        `INSERT INTO notifications (user_id, title, body, type) VALUES ($1, $2, $3, 'daily_report')`,
        [admin.id, '📊 Daily Campus Report', reportBody]
      );
    }
    console.log(`📊 Daily report sent to ${admins.rows.length} admins (${inside} still inside)`);
  } catch (error) {
    console.error('Daily report cron error:', error.message);
  }
});


// ===================== ERROR HANDLER =====================
app.use(errorHandler);

// ===================== 404 HANDLER =====================
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ===================== START SERVER =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 IIEST E-Gate Pass Server running on port ${PORT}`);
  console.log(`📡 API Base URL: http://localhost:${PORT}/api`);
  console.log(`❤️  Health Check: http://localhost:${PORT}/api/health\n`);
});

module.exports = app;
