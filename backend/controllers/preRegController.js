const pool = require('../config/db');
const { sendPushNotification } = require('../utils/pushNotification');
const { logActivity } = require('../utils/activityLogger');
const { generatePassCode, generateQRCode } = require('../utils/qrGenerator');
const { sendPreRegApprovalSMS } = require('../utils/smsService');
const { sendPreRegStatusEmail } = require('../utils/emailService');
const SERVER_PUBLIC_URL = process.env.SERVER_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;

// ============================================================
// PUBLIC ENDPOINTS (No Auth)
// ============================================================

// GET /api/pre-register/staff-list — list staff for the form dropdown
exports.getStaffList = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, department, designation
       FROM users
       WHERE role = 'staff' AND is_active = true AND is_approved = true
       ORDER BY full_name ASC`
    );
    res.json({ success: true, data: { staff: result.rows } });
  } catch (error) {
    next(error);
  }
};

// POST /api/pre-register — visitor submits a pre-registration
exports.createPreRegistration = async (req, res, next) => {
  try {
    const {
      visitor_name, visitor_phone, visitor_email,
      visitor_id_type, visitor_id_number, visitor_address,
      staff_id, purpose, scheduled_date, scheduled_time, notes,
    } = req.body;

    const photo_url = req.file ? `/uploads/${req.file.filename}` : null;

    // Validate required fields
    if (!visitor_name || !visitor_phone || !staff_id || !purpose || !scheduled_date) {
      return res.status(400).json({
        success: false,
        message: 'Name, phone, staff, purpose, and scheduled date are required',
      });
    }

    // Validate staff exists
    const staffCheck = await pool.query(
      `SELECT id, full_name, department, push_token FROM users WHERE id = $1 AND role = 'staff' AND is_active = true`,
      [staff_id]
    );
    if (staffCheck.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Selected staff member not found' });
    }
    const staff = staffCheck.rows[0];

    // Check if visitor exists or create new
    let visitor;
    const existingVisitor = await pool.query('SELECT * FROM visitors WHERE phone = $1', [visitor_phone.trim()]);

    if (existingVisitor.rows.length > 0) {
      visitor = existingVisitor.rows[0];

      if (visitor.is_blacklisted) {
        return res.status(403).json({
          success: false,
          message: `This phone number has been blacklisted. ${visitor.blacklist_reason ? 'Reason: ' + visitor.blacklist_reason : ''}`,
        });
      }

      // Update with new info
      await pool.query(
        `UPDATE visitors SET
          full_name = COALESCE($1, full_name),
          visitor_email = COALESCE($2, visitor_email),
          id_type = COALESCE($3, id_type),
          id_number = COALESCE($4, id_number),
          address = COALESCE($5, address),
          photo_url = COALESCE($6, photo_url)
        WHERE id = $7`,
        [visitor_name, visitor_email || null, visitor_id_type || null, visitor_id_number || null, visitor_address || null, photo_url, visitor.id]
      );
    } else {
      const newVisitor = await pool.query(
        `INSERT INTO visitors (full_name, phone, visitor_email, photo_url, id_type, id_number, address)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [visitor_name, visitor_phone.trim(), visitor_email || null, photo_url, visitor_id_type || null, visitor_id_number || null, visitor_address || null]
      );
      visitor = newVisitor.rows[0];
    }

    // Create pre-registration
    const result = await pool.query(
      `INSERT INTO pre_registrations (visitor_id, staff_id, purpose, scheduled_date, scheduled_time, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [visitor.id, staff_id, purpose, scheduled_date, scheduled_time || null, notes || null]
    );

    const preReg = result.rows[0];

    // Notify staff
    await pool.query(
      `INSERT INTO notifications (user_id, title, body, type, reference_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        staff_id,
        '📅 Pre-Visit Request',
        `${visitor_name} wants to visit you on ${scheduled_date}. Purpose: ${purpose}`,
        'pre_registration',
        preReg.id,
      ]
    );

    if (staff.push_token) {
      await sendPushNotification(
        staff.push_token,
        '📅 Pre-Visit Request',
        `${visitor_name} wants to visit you on ${scheduled_date}. Purpose: ${purpose}`,
        { type: 'pre_registration', preRegId: preReg.id }
      );
    }

    await logActivity(null, 'create_pre_registration', 'pre_registration', preReg.id, {
      visitor_name, staff_name: staff.full_name, purpose, scheduled_date,
    });

    res.status(201).json({
      success: true,
      message: 'Pre-registration submitted successfully',
      data: { pre_registration: preReg, visitor },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/pre-register/status/:id — visitor checks their pre-registration status
exports.getPreRegStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT pr.*, v.full_name as visitor_name, v.phone as visitor_phone, v.photo_url as visitor_photo,
              v.visitor_email, v.id_type as visitor_id_type, v.id_number as visitor_id_number,
              s.full_name as staff_name, s.department as staff_department, s.designation as staff_designation,
              gp.qr_data, gp.pass_code, gp.status as pass_status, gp.valid_until as pass_valid_until
       FROM pre_registrations pr
       JOIN visitors v ON pr.visitor_id = v.id
       JOIN users s ON pr.staff_id = s.id
       LEFT JOIN gate_passes gp ON pr.gate_pass_id = gp.id
       WHERE pr.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Pre-registration not found' });
    }

    res.json({ success: true, data: { pre_registration: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// STAFF ENDPOINTS (Authenticated)
// ============================================================

// GET /api/pre-register/pending — staff's pending pre-registrations
exports.getStaffPending = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT pr.*, v.full_name as visitor_name, v.phone as visitor_phone, v.photo_url as visitor_photo,
              v.visitor_email, v.id_type as visitor_id_type, v.id_number as visitor_id_number, v.address as visitor_address
       FROM pre_registrations pr
       JOIN visitors v ON pr.visitor_id = v.id
       WHERE pr.staff_id = $1 AND pr.status = 'pending'
       ORDER BY pr.scheduled_date ASC, pr.created_at DESC`,
      [req.user.id]
    );

    res.json({ success: true, data: { pre_registrations: result.rows } });
  } catch (error) {
    next(error);
  }
};

// GET /api/pre-register/all — staff/admin list all pre-registrations
exports.getAllPreRegistrations = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT pr.*, v.full_name as visitor_name, v.phone as visitor_phone, v.photo_url as visitor_photo,
             s.full_name as staff_name, s.department as staff_department
      FROM pre_registrations pr
      JOIN visitors v ON pr.visitor_id = v.id
      JOIN users s ON pr.staff_id = s.id
    `;
    const params = [];
    const conditions = [];

    // Staff sees only their own
    if (req.user.role === 'staff') {
      conditions.push(`pr.staff_id = $${params.length + 1}`);
      params.push(req.user.id);
    }

    if (status) {
      conditions.push(`pr.status = $${params.length + 1}`);
      params.push(status);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ` ORDER BY pr.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);
    res.json({ success: true, data: { pre_registrations: result.rows } });
  } catch (error) {
    next(error);
  }
};

// PUT /api/pre-register/:id/approve — staff approves pre-registration
exports.approvePreRegistration = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { validity_hours = 8, message } = req.body;

    // Fetch pre-registration
    const preRegResult = await pool.query('SELECT * FROM pre_registrations WHERE id = $1', [id]);
    if (preRegResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Pre-registration not found' });
    }

    const preReg = preRegResult.rows[0];

    if (preReg.staff_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You can only approve your own pre-registrations' });
    }

    if (preReg.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Pre-registration already ${preReg.status}` });
    }

    // Calculate valid_until: scheduled_date + validity_hours
    const scheduledDate = new Date(preReg.scheduled_date);
    if (preReg.scheduled_time) {
      const [hours, minutes] = preReg.scheduled_time.replace(/[APap][Mm]/, '').trim().split(':');
      scheduledDate.setHours(parseInt(hours) || 9, parseInt(minutes) || 0);
    } else {
      scheduledDate.setHours(9, 0); // default 9 AM
    }
    const valid_until = new Date(scheduledDate.getTime() + validity_hours * 60 * 60 * 1000);

    // Get a system guard for generated_by (use first active guard)
    const guardResult = await pool.query(
      `SELECT id FROM users WHERE role = 'guard' AND is_active = true AND is_approved = true LIMIT 1`
    );
    const systemGuardId = guardResult.rows.length > 0 ? guardResult.rows[0].id : req.user.id;

    // 1. Create a visit_request (pre-approved)
    const visitReqResult = await pool.query(
      `INSERT INTO visit_requests (visitor_id, guard_id, staff_id, purpose, status, pre_visit, scheduled_date, responded_at, valid_until, approval_message, notes)
       VALUES ($1, $2, $3, $4, 'approved', true, $5, NOW(), $6, $7, $8) RETURNING *`,
      [preReg.visitor_id, systemGuardId, req.user.id, preReg.purpose, preReg.scheduled_date, valid_until, message || 'Pre-approved via pre-registration', preReg.notes]
    );
    const visitRequest = visitReqResult.rows[0];

    // 2. Generate gate pass + QR code
    const visitorResult = await pool.query('SELECT full_name, phone, visitor_email FROM visitors WHERE id = $1', [preReg.visitor_id]);
    const visitor = visitorResult.rows[0];

    const pass_code = generatePassCode();
    const qrPayload = {
      pass_code,
      visitor_name: visitor.full_name,
      visitor_phone: visitor.phone,
      visit_type: 'professor_visit',
      pre_visit: true,
      valid_until: valid_until.toISOString(),
    };
    const qr_data = await generateQRCode(qrPayload);

    const gatePassResult = await pool.query(
      `INSERT INTO gate_passes (pass_code, visit_request_id, visitor_id, generated_by, qr_data, status, valid_until)
       VALUES ($1, $2, $3, $4, $5, 'active', $6) RETURNING *`,
      [pass_code, visitRequest.id, preReg.visitor_id, systemGuardId, qr_data, valid_until]
    );
    const gatePass = gatePassResult.rows[0];

    // 3. Update pre-registration with links
    await pool.query(
      `UPDATE pre_registrations SET
        status = 'approved', approved_at = NOW(), valid_until = $1,
        visit_request_id = $2, gate_pass_id = $3,
        approval_message = $4, updated_at = NOW()
       WHERE id = $5`,
      [valid_until, visitRequest.id, gatePass.id, message || null, id]
    );

    // Send SMS to visitor with their pass link
    try {
      const dateStr = new Date(preReg.scheduled_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      const smsResult = await sendPreRegApprovalSMS(
        visitor.phone, visitor.full_name, req.user.full_name, dateStr, pass_code
      );
      if (smsResult.success) {
        await pool.query('UPDATE gate_passes SET sms_sent = true, sms_sent_at = NOW() WHERE id = $1', [gatePass.id]);
      }
    } catch (smsErr) {
      console.log('Pre-reg SMS error (non-fatal):', smsErr.message);
    }

    try {
      const passUrl = `${SERVER_PUBLIC_URL}/pass/${pass_code}`;
      const emailResult = await sendPreRegStatusEmail(
        visitor.visitor_email,
        visitor.full_name,
        'approved',
        {
          staffName: req.user.full_name,
          scheduledDate: new Date(preReg.scheduled_date).toLocaleDateString('en-IN', { dateStyle: 'medium' }),
          passUrl,
        }
      );
      if (!emailResult.success) {
        console.log(`Pre-reg approval email skipped/failed (non-fatal): ${emailResult.error || 'unknown'}`);
      }
    } catch (emailErr) {
      console.log('Pre-reg approval email error (non-fatal):', emailErr.message);
    }

    await logActivity(req.user.id, 'approve_pre_registration', 'pre_registration', id, {
      visitor_name: visitor.full_name, validity_hours, pass_code,
    });

    res.json({
      success: true,
      message: 'Pre-registration approved. QR code generated & SMS sent to visitor.',
      data: {
        pre_registration: { ...preReg, status: 'approved', gate_pass_id: gatePass.id, visit_request_id: visitRequest.id },
        gate_pass: gatePass,
      },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/pre-register/:id/reject — staff rejects pre-registration
exports.rejectPreRegistration = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    const preRegResult = await pool.query('SELECT * FROM pre_registrations WHERE id = $1', [id]);
    if (preRegResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Pre-registration not found' });
    }

    const preReg = preRegResult.rows[0];
    const visitorResult = await pool.query('SELECT full_name, visitor_email FROM visitors WHERE id = $1', [preReg.visitor_id]);
    const visitor = visitorResult.rows[0];

    if (preReg.staff_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You can only reject your own pre-registrations' });
    }

    if (preReg.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Pre-registration already ${preReg.status}` });
    }

    await pool.query(
      `UPDATE pre_registrations SET status = 'rejected', reject_reason = $1, updated_at = NOW() WHERE id = $2`,
      [reason || null, id]
    );

    try {
      const emailResult = await sendPreRegStatusEmail(
        visitor?.visitor_email,
        visitor?.full_name || 'Visitor',
        'rejected',
        {
          staffName: req.user.full_name,
          scheduledDate: new Date(preReg.scheduled_date).toLocaleDateString('en-IN', { dateStyle: 'medium' }),
          rejectReason: reason || 'Not specified',
        }
      );
      if (!emailResult.success) {
        console.log(`Pre-reg rejection email skipped/failed (non-fatal): ${emailResult.error || 'unknown'}`);
      }
    } catch (emailErr) {
      console.log('Pre-reg rejection email error (non-fatal):', emailErr.message);
    }

    await logActivity(req.user.id, 'reject_pre_registration', 'pre_registration', id, { reason });

    res.json({
      success: true,
      message: 'Pre-registration rejected',
    });
  } catch (error) {
    next(error);
  }
};
