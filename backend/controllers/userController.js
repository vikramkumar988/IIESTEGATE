const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { saltRounds } = require('../config/auth');
const { logActivity } = require('../utils/activityLogger');

// Get all users (Admin)
exports.getUsers = async (req, res, next) => {
  try {
    const { role, search, approved } = req.query;
    let query = 'SELECT id, full_name, email, phone, role, organization, department, designation, gate_assigned, is_active, is_approved, created_at FROM users';
    const params = [];
    const conditions = [];

    if (role) {
      conditions.push(`role = $${params.length + 1}`);
      params.push(role);
    }
    if (search) {
      conditions.push(`(full_name ILIKE $${params.length + 1} OR email ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }
    if (approved !== undefined) {
      conditions.push(`is_approved = $${params.length + 1}`);
      params.push(approved === 'true');
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);

    res.json({ success: true, data: { users: result.rows } });
  } catch (error) {
    next(error);
  }
};

// Get single user by ID (Admin)
exports.getUserById = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, email, phone, role, organization, department, designation,
              gate_assigned, is_active, is_approved, created_at, updated_at
       FROM users WHERE id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: { user: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};

// Get pending users (Admin)
exports.getPendingUsers = async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, full_name, email, phone, role, organization, department, designation, gate_assigned, created_at FROM users WHERE is_approved = false AND is_active = true ORDER BY created_at DESC'
    );
    res.json({ success: true, data: { users: result.rows } });
  } catch (error) {
    next(error);
  }
};

// Approve user registration (Admin)
exports.approveUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE users SET is_approved = true, updated_at = NOW() WHERE id = $1 AND is_approved = false RETURNING id, full_name, email, role, organization',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found or already approved' });
    }

    const user = result.rows[0];

    // Notify approved user
    await pool.query(
      `INSERT INTO notifications (user_id, title, body, type, reference_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, 'Registration Approved ✅', 'Your registration has been approved! You can now login to the IIEST E-Gate Pass System.', 'registration_approved', id]
    );

    await logActivity(req.user.id, 'approve_user', 'user', id, { approved_name: user.full_name, role: user.role });

    res.json({ success: true, message: `${user.full_name} has been approved`, data: { user } });
  } catch (error) {
    next(error);
  }
};

// Reject user registration (Admin) — deactivate, keep record
exports.rejectUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id, full_name, email, role',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await logActivity(req.user.id, 'reject_user_registration', 'user', id, { rejected_name: result.rows[0].full_name });

    res.json({ success: true, message: `Registration for ${result.rows[0].full_name} has been rejected`, data: { user: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};

// Get user by ID
exports.getUserById = async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, full_name, email, phone, role, organization, department, designation, gate_assigned, is_active, is_approved, created_at FROM users WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: { user: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};

// Create user (Admin)
exports.createUser = async (req, res, next) => {
  try {
    const { full_name, email, phone, password, role, organization, department, designation, gate_assigned } = req.body;

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password || 'password123', saltRounds);

    const result = await pool.query(
      `INSERT INTO users (full_name, email, phone, password_hash, role, organization, department, designation, gate_assigned, is_approved)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true) RETURNING id, full_name, email, role, organization, department, designation`,
      [full_name, email, phone, password_hash, role, organization || 'iiest', department, designation, gate_assigned]
    );

    await logActivity(req.user.id, 'create_user_admin', 'user', result.rows[0].id, { role, email });

    res.status(201).json({ success: true, message: 'User created', data: { user: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};

// Update user (Admin)
exports.updateUser = async (req, res, next) => {
  try {
    const { full_name, phone, role, organization, department, designation, gate_assigned, is_active } = req.body;

    const result = await pool.query(
      `UPDATE users SET full_name = COALESCE($1, full_name), phone = COALESCE($2, phone),
       role = COALESCE($3, role), organization = COALESCE($4, organization),
       department = COALESCE($5, department), designation = COALESCE($6, designation),
       gate_assigned = COALESCE($7, gate_assigned), is_active = COALESCE($8, is_active), updated_at = NOW()
       WHERE id = $9 RETURNING id, full_name, email, role, organization, department, designation, is_active`,
      [full_name, phone, role, organization, department, designation, gate_assigned, is_active, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await logActivity(req.user.id, 'update_user', 'user', req.params.id, { full_name, role });

    res.json({ success: true, message: 'User updated', data: { user: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};

// Deactivate user
exports.deleteUser = async (req, res, next) => {
  try {
    const result = await pool.query(
      'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id, full_name',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await logActivity(req.user.id, 'deactivate_user', 'user', req.params.id, { name: result.rows[0].full_name });

    res.json({ success: true, message: 'User deactivated', data: { user: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};

// Search staff (for Guard dropdown when creating visit request)
exports.searchStaff = async (req, res, next) => {
  try {
    const { search, department } = req.query;
    let query = `SELECT id, full_name, email, department, designation, availability, availability_note, available_from FROM users WHERE role = 'staff' AND is_active = true AND is_approved = true`;
    const params = [];

    if (search) {
      query += ` AND (full_name ILIKE $${params.length + 1} OR email ILIKE $${params.length + 1})`;
      params.push(`%${search}%`);
    }
    if (department) {
      query += ` AND department = $${params.length + 1}`;
      params.push(department);
    }

    query += ' ORDER BY full_name ASC';
    const result = await pool.query(query, params);

    res.json({ success: true, data: { staff: result.rows } });
  } catch (error) {
    next(error);
  }
};

// ============== BLACKLIST MANAGEMENT ==============

// Blacklist a visitor (Admin)
exports.blacklistVisitor = async (req, res, next) => {
  try {
    const { visitor_id, reason } = req.body;
    if (!visitor_id) return res.status(400).json({ success: false, message: 'visitor_id is required' });

    const result = await pool.query(
      `UPDATE visitors SET is_blacklisted = true, blacklist_reason = $1 WHERE id = $2 RETURNING id, full_name, phone`,
      [reason || 'No reason provided', visitor_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Visitor not found' });
    }

    // Revoke all active passes for this visitor
    await pool.query(
      `UPDATE gate_passes SET status = 'revoked' WHERE visitor_id = $1 AND status = 'active'`,
      [visitor_id]
    );

    await logActivity(req.user.id, 'blacklist_visitor', 'visitor', visitor_id, {
      visitor_name: result.rows[0].full_name, reason,
    });

    res.json({ success: true, message: `${result.rows[0].full_name} has been blacklisted`, data: { visitor: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};

// Remove from blacklist (Admin)
exports.unblacklistVisitor = async (req, res, next) => {
  try {
    const { visitor_id } = req.body;
    const result = await pool.query(
      `UPDATE visitors SET is_blacklisted = false, blacklist_reason = NULL WHERE id = $1 RETURNING id, full_name, phone`,
      [visitor_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Visitor not found' });
    }

    await logActivity(req.user.id, 'unblacklist_visitor', 'visitor', visitor_id, {
      visitor_name: result.rows[0].full_name,
    });

    res.json({ success: true, message: `${result.rows[0].full_name} removed from blacklist`, data: { visitor: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};

// Get blacklisted visitors list (Admin)
exports.getBlacklistedVisitors = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, phone, photo_url, id_type, id_number, blacklist_reason, created_at
       FROM visitors WHERE is_blacklisted = true ORDER BY full_name ASC`
    );
    res.json({ success: true, data: { visitors: result.rows } });
  } catch (error) {
    next(error);
  }
};

// ============== STAFF AVAILABILITY ==============

// Update own availability (Staff)
exports.updateAvailability = async (req, res, next) => {
  try {
    const { availability, availability_note, available_from } = req.body;
    const validValues = ['available', 'in_meeting', 'on_leave', 'unavailable'];
    if (!validValues.includes(availability)) {
      return res.status(400).json({ success: false, message: `Invalid availability. Must be one of: ${validValues.join(', ')}` });
    }

    const result = await pool.query(
      `UPDATE users SET availability = $1, availability_note = $2, available_from = $3, updated_at = NOW()
       WHERE id = $4 RETURNING id, full_name, availability, availability_note, available_from`,
      [availability, availability_note || null, available_from || null, req.user.id]
    );

    await logActivity(req.user.id, 'update_availability', 'user', req.user.id, { availability, availability_note });

    res.json({ success: true, message: 'Availability updated', data: { user: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};

// ============== VISITORS STILL INSIDE CAMPUS ==============

exports.getStillInside = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT gp.id as pass_id, gp.pass_code, gp.entry_time, gp.valid_until,
              v.full_name as visitor_name, v.phone as visitor_phone, v.photo_url as visitor_photo,
              CASE WHEN gp.visit_request_id IS NOT NULL THEN 'professor_visit' ELSE 'general' END as visit_type,
              s.full_name as staff_name
       FROM gate_passes gp
       JOIN visitors v ON gp.visitor_id = v.id
       LEFT JOIN visit_requests vr ON gp.visit_request_id = vr.id
       LEFT JOIN users s ON vr.staff_id = s.id
       WHERE gp.entry_time IS NOT NULL AND gp.exit_time IS NULL
         AND DATE(gp.entry_time) = CURRENT_DATE
       ORDER BY gp.entry_time ASC`
    );
    res.json({ success: true, data: { visitors: result.rows, count: result.rows.length } });
  } catch (error) {
    next(error);
  }
};

// Force exit (Admin — manually record exit for someone who left without scanning)
exports.forceExit = async (req, res, next) => {
  try {
    const { pass_id } = req.body;
    const result = await pool.query(
      `UPDATE gate_passes SET exit_time = NOW(), status = 'used' WHERE id = $1 AND exit_time IS NULL RETURNING *`,
      [pass_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Pass not found or already exited' });
    }

    await logActivity(req.user.id, 'force_exit', 'gate_pass', pass_id, { pass_code: result.rows[0].pass_code });

    res.json({ success: true, message: 'Exit recorded', data: { gate_pass: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};
