const pool = require('../config/db');
const { sendPushNotification } = require('../utils/pushNotification');
const { logActivity } = require('../utils/activityLogger');

// Get overall dashboard stats (Admin)
exports.getStats = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Week start (Monday of current week)
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + (weekStart.getDay() === 0 ? -6 : 1));
    weekStart.setHours(0, 0, 0, 0);

    // Month start
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [totalUsers, totalVisitsToday, pendingRequests, activePasses, totalGuards, totalStaff, pendingUsers,
           visitsThisWeek, visitsThisMonth, generalVisitsThisWeek, generalVisitsThisMonth] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users WHERE is_active = true AND is_approved = true'),
      pool.query('SELECT COUNT(*) FROM visit_requests WHERE created_at >= $1', [today]),
      pool.query("SELECT COUNT(*) FROM visit_requests WHERE status = 'pending'"),
      pool.query("SELECT COUNT(*) FROM gate_passes WHERE status = 'active'"),
      pool.query("SELECT COUNT(*) FROM users WHERE role = 'guard' AND is_active = true AND is_approved = true"),
      pool.query("SELECT COUNT(*) FROM users WHERE role = 'staff' AND is_active = true AND is_approved = true"),
      pool.query("SELECT COUNT(*) FROM users WHERE is_approved = false AND is_active = true"),
      // Weekly counts
      pool.query('SELECT COUNT(*) FROM visit_requests WHERE created_at >= $1', [weekStart]),
      // Monthly counts
      pool.query('SELECT COUNT(*) FROM visit_requests WHERE created_at >= $1', [monthStart]),
      // General visits weekly/monthly
      pool.query('SELECT COUNT(*) FROM general_visits WHERE created_at >= $1', [weekStart]),
      pool.query('SELECT COUNT(*) FROM general_visits WHERE created_at >= $1', [monthStart]),
    ]);

    const generalVisitsToday = await pool.query(
      'SELECT COUNT(*) FROM general_visits WHERE created_at >= $1', [today]
    );

    const profVisitsToday = parseInt(totalVisitsToday.rows[0].count);
    const genVisitsToday = parseInt(generalVisitsToday.rows[0].count);
    const profVisitsWeek = parseInt(visitsThisWeek.rows[0].count);
    const genVisitsWeek = parseInt(generalVisitsThisWeek.rows[0].count);
    const profVisitsMonth = parseInt(visitsThisMonth.rows[0].count);
    const genVisitsMonth = parseInt(generalVisitsThisMonth.rows[0].count);

    res.json({
      success: true,
      data: {
        stats: {
          total_users: parseInt(totalUsers.rows[0].count),
          total_guards: parseInt(totalGuards.rows[0].count),
          total_staff: parseInt(totalStaff.rows[0].count),
          pending_users: parseInt(pendingUsers.rows[0].count),
          // Today
          visits_today: profVisitsToday + genVisitsToday,
          professor_visits_today: profVisitsToday,
          general_visits_today: genVisitsToday,
          // This Week
          visits_this_week: profVisitsWeek + genVisitsWeek,
          professor_visits_week: profVisitsWeek,
          general_visits_week: genVisitsWeek,
          // This Month
          visits_this_month: profVisitsMonth + genVisitsMonth,
          professor_visits_month: profVisitsMonth,
          general_visits_month: genVisitsMonth,
          // Other
          pending_requests: parseInt(pendingRequests.rows[0].count),
          active_passes: parseInt(activePasses.rows[0].count),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get visits chart data (last 7 or 30 days)
exports.getVisitsChart = async (req, res, next) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const result = await pool.query(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM visit_requests
       WHERE created_at >= $1
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [startDate]
    );

    const generalResult = await pool.query(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM general_visits
       WHERE created_at >= $1
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [startDate]
    );

    res.json({
      success: true,
      data: {
        professor_visits: result.rows,
        general_visits: generalResult.rows,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get currently active passes
exports.getActivePasses = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT gp.*, v.full_name as visitor_name, v.phone as visitor_phone,
              u.full_name as generated_by_name
       FROM gate_passes gp
       JOIN visitors v ON gp.visitor_id = v.id
       JOIN users u ON gp.generated_by = u.id
       WHERE gp.status = 'active'
       ORDER BY gp.created_at DESC`
    );

    res.json({ success: true, data: { passes: result.rows } });
  } catch (error) {
    next(error);
  }
};

// Get guard activity
exports.getGuardActivity = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.full_name, u.gate_assigned,
              (SELECT COUNT(*) FROM visit_requests WHERE guard_id = u.id AND created_at >= NOW() - INTERVAL '24 hours') as requests_today,
              (SELECT COUNT(*) FROM gate_passes WHERE generated_by = u.id AND created_at >= NOW() - INTERVAL '24 hours') as passes_today,
              (SELECT COUNT(*) FROM scan_logs WHERE scanned_by = u.id AND scanned_at >= NOW() - INTERVAL '24 hours') as scans_today
       FROM users u
       WHERE u.role = 'guard' AND u.is_active = true AND u.is_approved = true
       ORDER BY requests_today DESC`
    );

    res.json({ success: true, data: { guards: result.rows } });
  } catch (error) {
    next(error);
  }
};

// Get day-wise records
exports.getDayWiseRecords = async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const result = await pool.query(
      `SELECT 
        DATE(vr.created_at) as date,
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE vr.status = 'approved') as approved,
        COUNT(*) FILTER (WHERE vr.status = 'rejected') as rejected,
        COUNT(*) FILTER (WHERE vr.status = 'pending') as pending,
        COUNT(*) FILTER (WHERE vr.status = 'expired') as expired
       FROM visit_requests vr
       WHERE vr.created_at >= $1
       GROUP BY DATE(vr.created_at)
       ORDER BY date DESC`,
      [startDate]
    );

    const generalResult = await pool.query(
      `SELECT 
        DATE(gv.created_at) as date,
        COUNT(*) as total
       FROM general_visits gv
       WHERE gv.created_at >= $1
       GROUP BY DATE(gv.created_at)
       ORDER BY date DESC`,
      [startDate]
    );

    res.json({
      success: true,
      data: {
        visit_requests: result.rows,
        general_visits: generalResult.rows,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get activity logs (Admin)
exports.getActivityLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 30, action, entity_type } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT al.*, u.full_name as user_name, u.role as user_role
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
    `;
    const params = [];
    const conditions = [];

    if (action) {
      conditions.push(`al.action = $${params.length + 1}`);
      params.push(action);
    }
    if (entity_type) {
      conditions.push(`al.entity_type = $${params.length + 1}`);
      params.push(entity_type);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ` ORDER BY al.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Total count
    let countQuery = 'SELECT COUNT(*) FROM activity_logs al';
    const countParams = [];
    const countConditions = [];
    if (action) {
      countConditions.push(`al.action = $${countParams.length + 1}`);
      countParams.push(action);
    }
    if (entity_type) {
      countConditions.push(`al.entity_type = $${countParams.length + 1}`);
      countParams.push(entity_type);
    }
    if (countConditions.length > 0) {
      countQuery += ' WHERE ' + countConditions.join(' AND ');
    }
    const countResult = await pool.query(countQuery, countParams);

    res.json({
      success: true,
      data: {
        logs: result.rows,
        pagination: {
          total: parseInt(countResult.rows[0].count),
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(countResult.rows[0].count / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============== LOCKDOWN MANAGEMENT ==============

// Get lockdown status
exports.getLockdownStatus = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, reason, activated_at, activated_by FROM campus_lockdowns WHERE is_active = true LIMIT 1`
    );
    const isActive = result.rows.length > 0;
    let activatedBy = null;
    if (isActive) {
      const userResult = await pool.query('SELECT full_name FROM users WHERE id = $1', [result.rows[0].activated_by]);
      activatedBy = userResult.rows[0]?.full_name || 'Unknown';
    }
    res.json({
      success: true,
      data: {
        is_lockdown: isActive,
        lockdown: isActive ? { ...result.rows[0], activated_by_name: activatedBy } : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Activate lockdown (Admin only)
exports.activateLockdown = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, message: 'Reason is required' });

    // Insert lockdown record
    const result = await pool.query(
      `INSERT INTO campus_lockdowns (activated_by, reason) VALUES ($1, $2) RETURNING *`,
      [req.user.id, reason]
    );

    // Revoke ALL active gate passes
    const revoked = await pool.query(
      `UPDATE gate_passes SET status = 'revoked' WHERE status = 'active' RETURNING id`
    );

    // Notify ALL guards and staff
    const users = await pool.query(
      `SELECT id, push_token FROM users WHERE role IN ('guard', 'staff') AND is_active = true AND push_token IS NOT NULL`
    );
    for (const user of users.rows) {
      try {
        await sendPushNotification(
          user.push_token,
          '🚨 CAMPUS LOCKDOWN ACTIVATED',
          `All visitor entry/exit SUSPENDED. Reason: ${reason}. ${revoked.rows.length} passes revoked.`
        );
      } catch (e) { /* continue on push error */ }
      await pool.query(
        `INSERT INTO notifications (user_id, title, body, type, reference_id) VALUES ($1, $2, $3, $4, $5)`,
        [user.id, '🚨 CAMPUS LOCKDOWN', `Reason: ${reason}`, 'lockdown', result.rows[0].id]
      );
    }

    await logActivity(req.user.id, 'activate_lockdown', 'campus_lockdown', result.rows[0].id, {
      reason, passes_revoked: revoked.rows.length,
    });

    res.json({
      success: true,
      message: `Lockdown activated. ${revoked.rows.length} passes revoked.`,
      data: { lockdown: result.rows[0] },
    });
  } catch (error) {
    next(error);
  }
};

// Lift lockdown
exports.liftLockdown = async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE campus_lockdowns SET is_active = false, lifted_at = NOW()
       WHERE is_active = true RETURNING *`
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No active lockdown found' });
    }

    // Notify all guards
    const guards = await pool.query(
      `SELECT id, push_token FROM users WHERE role = 'guard' AND is_active = true AND push_token IS NOT NULL`
    );
    for (const guard of guards.rows) {
      try {
        await sendPushNotification(guard.push_token, '✅ LOCKDOWN LIFTED', 'Campus lockdown has been lifted. Normal operations may resume.');
      } catch (e) { /* continue */ }
      await pool.query(
        `INSERT INTO notifications (user_id, title, body, type, reference_id) VALUES ($1, $2, $3, $4, $5)`,
        [guard.id, '✅ LOCKDOWN LIFTED', 'Normal operations may resume.', 'lockdown_lifted', result.rows[0].id]
      );
    }

    await logActivity(req.user.id, 'lift_lockdown', 'campus_lockdown', result.rows[0].id, {});

    res.json({ success: true, message: 'Lockdown lifted', data: { lockdown: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};

// ============== DATE RANGE REPORT (Admin) ==============
exports.getDateRangeReport = async (req, res, next) => {
  try {
    const { date_from, date_to } = req.query;
    
    if (!date_from || !date_to) {
      return res.status(400).json({ success: false, message: 'date_from and date_to are required' });
    }

    const from = new Date(date_from);
    const to = new Date(date_to);
    to.setHours(23, 59, 59, 999);

    const [
      totalVisits, approvedVisits, rejectedVisits,
      generalVisits, uniqueVisitors, 
      entries, exits, avgDuration,
      peakHours, staffBreakdown, guardBreakdown
    ] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM visit_requests WHERE created_at BETWEEN $1 AND $2`, [from, to]),
      pool.query(`SELECT COUNT(*) FROM visit_requests WHERE status = 'approved' AND created_at BETWEEN $1 AND $2`, [from, to]),
      pool.query(`SELECT COUNT(*) FROM visit_requests WHERE status = 'rejected' AND created_at BETWEEN $1 AND $2`, [from, to]),
      pool.query(`SELECT COUNT(*) FROM general_visits WHERE created_at BETWEEN $1 AND $2`, [from, to]),
      pool.query(`SELECT COUNT(DISTINCT visitor_id) FROM visit_requests WHERE created_at BETWEEN $1 AND $2`, [from, to]),
      pool.query(`SELECT COUNT(*) FROM gate_passes WHERE entry_time BETWEEN $1 AND $2`, [from, to]),
      pool.query(`SELECT COUNT(*) FROM gate_passes WHERE exit_time BETWEEN $1 AND $2`, [from, to]),
      pool.query(`SELECT AVG(EXTRACT(EPOCH FROM (exit_time - entry_time)) / 60.0) as avg_minutes
                  FROM gate_passes WHERE entry_time BETWEEN $1 AND $2 AND exit_time IS NOT NULL`, [from, to]),
      // Peak hours
      pool.query(`SELECT EXTRACT(HOUR FROM entry_time) as hour, COUNT(*) as count
                  FROM gate_passes WHERE entry_time BETWEEN $1 AND $2
                  GROUP BY hour ORDER BY count DESC LIMIT 5`, [from, to]),
      // Staff breakdown
      pool.query(`SELECT s.full_name, s.department, 
                    COUNT(*) as total_requests,
                    COUNT(*) FILTER (WHERE vr.status = 'approved') as approved,
                    COUNT(*) FILTER (WHERE vr.status = 'rejected') as rejected,
                    AVG(CASE WHEN vr.responded_at IS NOT NULL 
                      THEN EXTRACT(EPOCH FROM (vr.responded_at - vr.requested_at)) / 60.0 END) as avg_response_min
                  FROM visit_requests vr JOIN users s ON vr.staff_id = s.id
                  WHERE vr.created_at BETWEEN $1 AND $2
                  GROUP BY s.id, s.full_name, s.department ORDER BY total_requests DESC LIMIT 15`, [from, to]),
      // Guard breakdown
      pool.query(`SELECT g.full_name, g.gate_assigned,
                    COUNT(*) as requests_created,
                    COUNT(DISTINCT sl.id) as scans_performed
                  FROM visit_requests vr JOIN users g ON vr.guard_id = g.id
                  LEFT JOIN scan_logs sl ON sl.scanned_by = g.id AND sl.scanned_at BETWEEN $3 AND $4
                  WHERE vr.created_at BETWEEN $1 AND $2
                  GROUP BY g.id, g.full_name, g.gate_assigned ORDER BY requests_created DESC LIMIT 10`, [from, to, from, to]),
    ]);

    // Repeat visitors
    const repeatVisitors = await pool.query(
      `SELECT v.full_name, v.phone, COUNT(*) as visit_count
       FROM visit_requests vr JOIN visitors v ON vr.visitor_id = v.id
       WHERE vr.created_at BETWEEN $1 AND $2
       GROUP BY v.id, v.full_name, v.phone HAVING COUNT(*) > 1
       ORDER BY visit_count DESC LIMIT 10`, [from, to]
    );

    // Visit type distribution
    const typeDistribution = await pool.query(
      `SELECT 
         COUNT(*) FILTER (WHERE vr.pre_visit = true) as pre_registered,
         COUNT(*) FILTER (WHERE vr.pre_visit = false OR vr.pre_visit IS NULL) as walk_in,
         COUNT(*) FILTER (WHERE vr.referred_by_staff IS NOT NULL) as referrals
       FROM visit_requests vr WHERE vr.created_at BETWEEN $1 AND $2`, [from, to]
    );

    // Daily breakdown for chart
    const dailyBreakdown = await pool.query(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM visit_requests WHERE created_at BETWEEN $1 AND $2
       GROUP BY DATE(created_at) ORDER BY date ASC`, [from, to]
    );

    res.json({
      success: true,
      data: {
        report: {
          date_from: date_from,
          date_to: date_to,
          total_professor_visits: parseInt(totalVisits.rows[0].count),
          total_general_visits: parseInt(generalVisits.rows[0].count),
          total_approved: parseInt(approvedVisits.rows[0].count),
          total_rejected: parseInt(rejectedVisits.rows[0].count),
          unique_visitors: parseInt(uniqueVisitors.rows[0].count),
          total_entries: parseInt(entries.rows[0].count),
          total_exits: parseInt(exits.rows[0].count),
          avg_visit_duration_min: avgDuration.rows[0]?.avg_minutes 
            ? parseFloat(avgDuration.rows[0].avg_minutes).toFixed(1) : null,
          peak_hours: peakHours.rows.map(r => ({ hour: parseInt(r.hour), count: parseInt(r.count) })),
          staff_breakdown: staffBreakdown.rows,
          guard_breakdown: guardBreakdown.rows,
          repeat_visitors: repeatVisitors.rows,
          type_distribution: typeDistribution.rows[0] || {},
          daily_breakdown: dailyBreakdown.rows,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============== SCAN LOGS (Admin) ==============
exports.getScanLogs = async (req, res, next) => {
  try {
    const { date_from, date_to, guard_id, scan_type, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    const conditions = [];

    if (date_from) {
      conditions.push(`sl.scanned_at >= $${params.length + 1}`);
      params.push(new Date(date_from));
    }
    if (date_to) {
      const to = new Date(date_to);
      to.setHours(23, 59, 59, 999);
      conditions.push(`sl.scanned_at <= $${params.length + 1}`);
      params.push(to);
    }
    if (guard_id) {
      conditions.push(`sl.scanned_by = $${params.length + 1}`);
      params.push(guard_id);
    }
    if (scan_type) {
      conditions.push(`sl.scan_type = $${params.length + 1}`);
      params.push(scan_type);
    }

    let query = `
      SELECT sl.*, 
             u.full_name as scanned_by_name, u.gate_assigned,
             gp.pass_code, gp.status as pass_status,
             v.full_name as visitor_name, v.phone as visitor_phone
      FROM scan_logs sl
      JOIN users u ON sl.scanned_by = u.id
      JOIN gate_passes gp ON sl.gate_pass_id = gp.id
      JOIN visitors v ON gp.visitor_id = v.id
    `;

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ` ORDER BY sl.scanned_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Total count for pagination
    let countQuery = `SELECT COUNT(*) FROM scan_logs sl`;
    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }
    const countResult = await pool.query(countQuery, params.slice(0, -2));

    res.json({
      success: true,
      data: {
        scan_logs: result.rows,
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============== STAFF PERFORMANCE (Admin) ==============
exports.getStaffPerformance = async (req, res, next) => {
  try {
    const { date_from, date_to } = req.query;
    const from = date_from ? new Date(date_from) : new Date(new Date().setDate(new Date().getDate() - 30));
    const to = date_to ? new Date(date_to) : new Date();
    to.setHours(23, 59, 59, 999);

    const result = await pool.query(
      `SELECT s.id, s.full_name, s.department, s.designation,
              COUNT(*) as total_requests,
              COUNT(*) FILTER (WHERE vr.status = 'approved') as approved,
              COUNT(*) FILTER (WHERE vr.status = 'rejected') as rejected,
              ROUND(100.0 * COUNT(*) FILTER (WHERE vr.status = 'approved') / NULLIF(COUNT(*), 0), 1) as approval_rate,
              AVG(CASE WHEN vr.responded_at IS NOT NULL AND vr.requested_at IS NOT NULL
                THEN EXTRACT(EPOCH FROM (vr.responded_at - vr.requested_at)) / 60.0 END) as avg_response_min,
              MIN(CASE WHEN vr.responded_at IS NOT NULL AND vr.requested_at IS NOT NULL
                THEN EXTRACT(EPOCH FROM (vr.responded_at - vr.requested_at)) / 60.0 END) as min_response_min,
              MAX(CASE WHEN vr.responded_at IS NOT NULL AND vr.requested_at IS NOT NULL
                THEN EXTRACT(EPOCH FROM (vr.responded_at - vr.requested_at)) / 60.0 END) as max_response_min,
              COUNT(DISTINCT vr.visitor_id) as unique_visitors
       FROM visit_requests vr
       JOIN users s ON vr.staff_id = s.id
       WHERE vr.created_at BETWEEN $1 AND $2
       GROUP BY s.id, s.full_name, s.department, s.designation
       ORDER BY total_requests DESC`,
      [from, to]
    );

    res.json({
      success: true,
      data: { staff_performance: result.rows, date_from: from, date_to: to },
    });
  } catch (error) {
    next(error);
  }
};
