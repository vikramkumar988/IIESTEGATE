const pool = require('../config/db');
const { sendPushNotification } = require('../utils/pushNotification');
const { logActivity } = require('../utils/activityLogger');
const { generatePassCode, generateQRCode } = require('../utils/qrGenerator');
const { sendPassSMS } = require('../utils/smsService');
const { sendGatePassEmail } = require('../utils/emailService');
const SERVER_PUBLIC_URL = process.env.SERVER_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;

// Lookup a visitor by phone number (Guard — for auto-fill)
exports.lookupVisitorByPhone = async (req, res, next) => {
  try {
    const { phone } = req.query;
    if (!phone || phone.trim().length < 5) {
      return res.json({ success: true, data: { visitor: null } });
    }
    const result = await pool.query(
      'SELECT id, full_name, phone, id_type, id_number, address, photo_url, is_blacklisted, blacklist_reason FROM visitors WHERE phone = $1',
      [phone.trim()]
    );
    res.json({
      success: true,
      data: { visitor: result.rows[0] || null },
    });
  } catch (error) {
    next(error);
  }
};

// Create a visit request (Guard)
exports.createVisitRequest = async (req, res, next) => {
  try {
    const { visitor_name, visitor_phone, visitor_id_type, visitor_id_number, visitor_address, staff_id, purpose, notes } = req.body;
    const guard_id = req.user.id;
    const photo_url = req.file ? `/uploads/${req.file.filename}` : null;

    // Check if visitor already exists by phone
    let visitorResult = await pool.query('SELECT * FROM visitors WHERE phone = $1', [visitor_phone]);
    let visitor;

    if (visitorResult.rows.length > 0) {
      visitor = visitorResult.rows[0];
      // Check blacklist
      if (visitor.is_blacklisted) {
        return res.status(403).json({
          success: false,
          message: `This visitor is blacklisted. Reason: ${visitor.blacklist_reason || 'No reason provided'}`,
        });
      }
      // Update photo if new one captured
      if (photo_url) {
        await pool.query('UPDATE visitors SET photo_url = $1, full_name = $2 WHERE id = $3', [photo_url, visitor_name, visitor.id]);
        visitor.photo_url = photo_url;
      }
    } else {
      // Create new visitor
      const newVisitor = await pool.query(
        `INSERT INTO visitors (full_name, phone, photo_url, id_type, id_number, address)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [visitor_name, visitor_phone, photo_url, visitor_id_type, visitor_id_number, visitor_address]
      );
      visitor = newVisitor.rows[0];
    }

    // Create the visit request
    const result = await pool.query(
      `INSERT INTO visit_requests (visitor_id, guard_id, staff_id, purpose, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [visitor.id, guard_id, staff_id, purpose, notes]
    );

    const visitRequest = result.rows[0];

    // Get staff details for notification
    const staffResult = await pool.query('SELECT full_name, push_token FROM users WHERE id = $1', [staff_id]);
    const staff = staffResult.rows[0];

    // Create notification for staff
    await pool.query(
      `INSERT INTO notifications (user_id, title, body, type, reference_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        staff_id,
        'New Visit Request',
        `${visitor_name} wants to visit you. Purpose: ${purpose}`,
        'visit_request',
        visitRequest.id,
      ]
    );

    // Send push notification
    if (staff && staff.push_token) {
      await sendPushNotification(
        staff.push_token,
        'New Visit Request 🚪',
        `${visitor_name} wants to meet you. Purpose: ${purpose}`,
        { type: 'visit_request', requestId: visitRequest.id }
      );
    }

    await logActivity(guard_id, 'create_visit_request', 'visit_request', visitRequest.id, { visitor_name, staff_name: staff?.full_name, purpose });

    res.status(201).json({
      success: true,
      message: 'Visit request created successfully',
      data: {
        visit_request: visitRequest,
        visitor,
        staff_name: staff ? staff.full_name : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Edit a pending visit request (Guard)
exports.editVisitRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { visitor_name, visitor_phone, purpose, staff_id, notes } = req.body;

    // Fetch the request
    const request = await pool.query('SELECT * FROM visit_requests WHERE id = $1', [id]);
    if (request.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Visit request not found' });
    }

    const visitRequest = request.rows[0];

    // Only the guard who created it can edit
    if (visitRequest.guard_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You can only edit your own requests' });
    }

    // Only pending requests can be edited
    if (visitRequest.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Only pending requests can be edited' });
    }

    // Update visitor info
    if (visitor_name || visitor_phone) {
      await pool.query(
        'UPDATE visitors SET full_name = COALESCE($1, full_name), phone = COALESCE($2, phone) WHERE id = $3',
        [visitor_name, visitor_phone, visitRequest.visitor_id]
      );
    }

    // Build update fields
    const updates = [];
    const params = [];
    let paramCount = 0;

    if (purpose) {
      paramCount++;
      updates.push(`purpose = $${paramCount}`);
      params.push(purpose);
    }
    if (staff_id) {
      paramCount++;
      updates.push(`staff_id = $${paramCount}`);
      params.push(staff_id);
    }
    if (notes !== undefined) {
      paramCount++;
      updates.push(`notes = $${paramCount}`);
      params.push(notes);
    }

    if (updates.length > 0) {
      paramCount++;
      updates.push(`updated_at = NOW()`);
      params.push(id);
      await pool.query(
        `UPDATE visit_requests SET ${updates.join(', ')} WHERE id = $${paramCount}`,
        params
      );
    }

    // If staff was changed, notify the new staff
    if (staff_id && staff_id !== visitRequest.staff_id) {
      const visitorRes = await pool.query('SELECT full_name FROM visitors WHERE id = $1', [visitRequest.visitor_id]);
      const newStaff = await pool.query('SELECT full_name, push_token FROM users WHERE id = $1', [staff_id]);
      if (newStaff.rows[0]) {
        await pool.query(
          `INSERT INTO notifications (user_id, title, body, type, reference_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [staff_id, 'New Visit Request', `${visitorRes.rows[0]?.full_name || 'A visitor'} wants to visit you. Purpose: ${purpose || visitRequest.purpose}`, 'visit_request', id]
        );
        if (newStaff.rows[0].push_token) {
          await sendPushNotification(newStaff.rows[0].push_token, 'New Visit Request 🚪', `${visitorRes.rows[0]?.full_name || 'A visitor'} wants to meet you.`, { type: 'visit_request', requestId: id });
        }
      }
    }

    await logActivity(req.user.id, 'edit_visit_request', 'visit_request', id, { purpose, staff_id, notes });

    // Return updated request
    const updatedResult = await pool.query(
      `SELECT vr.*, v.full_name as visitor_name, v.phone as visitor_phone, v.photo_url as visitor_photo,
              s.full_name as staff_name, s.department as staff_department
       FROM visit_requests vr
       JOIN visitors v ON vr.visitor_id = v.id
       JOIN users s ON vr.staff_id = s.id
       WHERE vr.id = $1`,
      [id]
    );

    res.json({
      success: true,
      message: 'Visit request updated successfully',
      data: { visit_request: updatedResult.rows[0] },
    });
  } catch (error) {
    next(error);
  }
};

// Re-raise an expired request (Guard)
exports.reRaiseRequest = async (req, res, next) => {
  try {
    const { id } = req.params;

    const request = await pool.query('SELECT * FROM visit_requests WHERE id = $1', [id]);
    if (request.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Visit request not found' });
    }

    const visitRequest = request.rows[0];

    if (visitRequest.guard_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You can only re-raise your own requests' });
    }

    if (visitRequest.status !== 'expired') {
      return res.status(400).json({ success: false, message: 'Only expired requests can be re-raised' });
    }

    // Reset request to pending
    const result = await pool.query(
      `UPDATE visit_requests SET status = 'pending', requested_at = NOW(), responded_at = NULL, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );

    // Re-notify the staff
    const visitorRes = await pool.query('SELECT full_name FROM visitors WHERE id = $1', [visitRequest.visitor_id]);
    const staffRes = await pool.query('SELECT full_name, push_token FROM users WHERE id = $1', [visitRequest.staff_id]);
    const staff = staffRes.rows[0];

    await pool.query(
      `INSERT INTO notifications (user_id, title, body, type, reference_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [visitRequest.staff_id, 'Visit Request Re-Raised 🔄', `${visitorRes.rows[0]?.full_name || 'A visitor'} — request has been re-raised. Purpose: ${visitRequest.purpose}`, 'visit_request', id]
    );

    if (staff && staff.push_token) {
      await sendPushNotification(staff.push_token, 'Visit Request Re-Raised 🔄', `${visitorRes.rows[0]?.full_name || 'A visitor'} — request re-raised.`, { type: 'visit_request', requestId: id });
    }

    await logActivity(req.user.id, 're_raise_request', 'visit_request', id, { purpose: visitRequest.purpose });

    res.json({
      success: true,
      message: 'Request re-raised successfully. Staff has been re-notified.',
      data: { visit_request: result.rows[0] },
    });
  } catch (error) {
    next(error);
  }
};

// Get all visit requests (Guard/Admin — ALL guards see ALL requests campus-wide)
exports.getVisitRequests = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Auto-expire passes that are past valid_until
    await pool.query(
      `UPDATE visit_requests SET status = 'expired', updated_at = NOW()
       WHERE status = 'approved' AND valid_until IS NOT NULL AND valid_until < NOW()
       AND id NOT IN (SELECT visit_request_id FROM gate_passes WHERE entry_time IS NOT NULL AND exit_time IS NULL AND visit_request_id IS NOT NULL)`
    );
    await pool.query(
      `UPDATE gate_passes SET status = 'expired'
       WHERE status = 'active' AND valid_until < NOW() AND entry_time IS NULL`
    );

    let query = `
      SELECT vr.*, v.full_name as visitor_name, v.phone as visitor_phone, v.photo_url as visitor_photo,
             g.full_name as guard_name, s.full_name as staff_name, s.department as staff_department,
             gp.entry_time, gp.exit_time, gp.sms_sent, gp.pass_code, gp.status as pass_status, gp.valid_until as pass_valid_until
      FROM visit_requests vr
      JOIN visitors v ON vr.visitor_id = v.id
      JOIN users g ON vr.guard_id = g.id
      JOIN users s ON vr.staff_id = s.id
      LEFT JOIN (
        SELECT DISTINCT ON (visit_request_id) * 
        FROM gate_passes 
        ORDER BY visit_request_id, created_at DESC
      ) gp ON gp.visit_request_id = vr.id
    `;
    const params = [];
    const conditions = [];

    // No guard_id filter — all guards see all requests

    if (status) {
      conditions.push(`vr.status = $${params.length + 1}`);
      params.push(status);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ` ORDER BY vr.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM visit_requests vr';
    const countParams = [];
    const countConditions = [];

    if (status) {
      countConditions.push(`vr.status = $${countParams.length + 1}`);
      countParams.push(status);
    }
    if (countConditions.length > 0) {
      countQuery += ' WHERE ' + countConditions.join(' AND ');
    }
    const countResult = await pool.query(countQuery, countParams);

    res.json({
      success: true,
      data: {
        visits: result.rows,
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

// Get pending requests for a staff member
exports.getPendingRequests = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT vr.*, v.full_name as visitor_name, v.phone as visitor_phone, v.photo_url as visitor_photo,
              v.id_type as visitor_id_type, v.id_number as visitor_id_number, v.address as visitor_address,
              g.full_name as guard_name, g.gate_assigned
       FROM visit_requests vr
       JOIN visitors v ON vr.visitor_id = v.id
       JOIN users g ON vr.guard_id = g.id
       WHERE vr.staff_id = $1 AND vr.status = 'pending'
       ORDER BY vr.created_at DESC`,
      [req.user.id]
    );

    res.json({ success: true, data: { requests: result.rows } });
  } catch (error) {
    next(error);
  }
};

// Get single visit request detail
exports.getVisitRequest = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT vr.*, v.full_name as visitor_name, v.phone as visitor_phone, v.photo_url as visitor_photo,
              v.id_type as visitor_id_type, v.id_number as visitor_id_number, v.address as visitor_address,
              g.full_name as guard_name, g.gate_assigned,
              s.full_name as staff_name, s.department as staff_department, s.designation as staff_designation
       FROM visit_requests vr
       JOIN visitors v ON vr.visitor_id = v.id
       JOIN users g ON vr.guard_id = g.id
       JOIN users s ON vr.staff_id = s.id
       WHERE vr.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Visit request not found' });
    }

    res.json({ success: true, data: { visit_request: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};

// Approve visit request (Staff)
// Auto-generates a gate pass and sends SMS to visitor immediately
exports.approveRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { validity_hours = 4, message } = req.body;

    const request = await pool.query('SELECT * FROM visit_requests WHERE id = $1', [id]);
    if (request.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Visit request not found' });
    }

    if (request.rows[0].staff_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You can only approve your own requests' });
    }

    if (request.rows[0].status !== 'pending') {
      return res.status(400).json({ success: false, message: `Request already ${request.rows[0].status}` });
    }

    const valid_until = new Date(Date.now() + validity_hours * 60 * 60 * 1000);

    const result = await pool.query(
      `UPDATE visit_requests SET status = 'approved', responded_at = NOW(), valid_until = $1, approval_message = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [valid_until, message || null, id]
    );

    // Get visitor details for SMS + email + gate pass
    const visitorResult = await pool.query('SELECT full_name, phone, visitor_email FROM visitors WHERE id = $1', [request.rows[0].visitor_id]);
    const visitor = visitorResult.rows[0];

    // Get guard info for notification
    const guardResult = await pool.query('SELECT full_name, push_token FROM users WHERE id = $1', [request.rows[0].guard_id]);
    const guard = guardResult.rows[0];

    // Create notification for guard
    const notifBody = `${req.user.full_name} approved the visit request for ${visitor.full_name}. Valid for ${validity_hours} hours.${message ? ' Message: ' + message : ''}`;
    await pool.query(
      `INSERT INTO notifications (user_id, title, body, type, reference_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [request.rows[0].guard_id, 'Request Approved ✅', notifBody, 'approval', id]
    );

    // Send push to guard
    if (guard && guard.push_token) {
      await sendPushNotification(guard.push_token, 'Request Approved ✅', `${req.user.full_name} approved the visit for ${visitor.full_name}`, { type: 'approval', requestId: id });
    }

    // ===== AUTO-GENERATE GATE PASS + SEND SMS IMMEDIATELY =====
    let gatePass = null;
    try {
      // Check if pass already exists
      const existingPass = await pool.query(
        'SELECT * FROM gate_passes WHERE visit_request_id = $1 AND status = $2',
        [id, 'active']
      );

      if (existingPass.rows.length > 0) {
        gatePass = existingPass.rows[0];
      } else {
        const pass_code = generatePassCode();
        const qrPayload = {
          pass_code,
          visitor_name: visitor.full_name,
          visitor_phone: visitor.phone,
          visit_type: 'professor_visit',
          valid_until: valid_until.toISOString(),
        };
        const qr_data = await generateQRCode(qrPayload);

        const passResult = await pool.query(
          `INSERT INTO gate_passes (pass_code, visit_request_id, visitor_id, generated_by, qr_data, status, valid_until)
           VALUES ($1, $2, $3, $4, $5, 'active', $6) RETURNING *`,
          [pass_code, id, request.rows[0].visitor_id, request.rows[0].guard_id, qr_data, valid_until]
        );
        gatePass = passResult.rows[0];
      }

      // Send SMS + email with pass link to visitor immediately
      if (gatePass) {
        const passUrl = `${SERVER_PUBLIC_URL}/pass/${gatePass.pass_code}`;

        try {
          const smsResult = await sendPassSMS(visitor.phone, gatePass.pass_code, visitor.full_name);
          if (smsResult.success) {
            await pool.query('UPDATE gate_passes SET sms_sent = true, sms_sent_at = NOW() WHERE id = $1', [gatePass.id]);
          }
        } catch (smsErr) {
          console.log('SMS send error on approval (non-fatal):', smsErr.message);
        }

        try {
          const emailResult = await sendGatePassEmail(
            visitor.visitor_email,
            visitor.full_name,
            gatePass.pass_code,
            passUrl,
            {
              staffName: req.user.full_name,
              purpose: request.rows[0].purpose,
              validUntil: gatePass.valid_until,
            }
          );
          if (!emailResult.success) {
            console.log(`Email send skipped/failed (non-fatal): ${emailResult.error || 'unknown'}`);
          }
        } catch (emailErr) {
          console.log('Email send error on approval (non-fatal):', emailErr.message);
        }
      }
    } catch (passErr) {
      console.log('Auto gate pass generation error (non-fatal):', passErr.message);
    }

    await logActivity(req.user.id, 'approve_request', 'visit_request', id, { validity_hours, message });

    res.json({
      success: true,
      message: 'Visit request approved. Gate pass generated and SMS sent to visitor.',
      data: { visit_request: result.rows[0], gate_pass: gatePass },
    });
  } catch (error) {
    next(error);
  }
};

// Reject visit request (Staff)
exports.rejectRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    const request = await pool.query('SELECT * FROM visit_requests WHERE id = $1', [id]);
    if (request.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Visit request not found' });
    }

    if (request.rows[0].staff_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You can only reject your own requests' });
    }

    if (request.rows[0].status !== 'pending') {
      return res.status(400).json({ success: false, message: `Request already ${request.rows[0].status}` });
    }

    const result = await pool.query(
      `UPDATE visit_requests SET status = 'rejected', reject_reason = $1, responded_at = NOW(), updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [reason, id]
    );

    // Notify guard
    const guardResult = await pool.query('SELECT full_name, push_token FROM users WHERE id = $1', [request.rows[0].guard_id]);
    const guard = guardResult.rows[0];
    const visitorResult = await pool.query('SELECT full_name FROM visitors WHERE id = $1', [request.rows[0].visitor_id]);

    await pool.query(
      `INSERT INTO notifications (user_id, title, body, type, reference_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        request.rows[0].guard_id,
        'Request Rejected ❌',
        `${req.user.full_name} rejected the visit request for ${visitorResult.rows[0].full_name}. ${reason ? 'Reason: ' + reason : ''}`,
        'rejection',
        id,
      ]
    );

    if (guard && guard.push_token) {
      await sendPushNotification(guard.push_token, 'Request Rejected ❌', `${req.user.full_name} rejected the visit for ${visitorResult.rows[0].full_name}`, { type: 'rejection', requestId: id });
    }

    await logActivity(req.user.id, 'reject_request', 'visit_request', id, { reason });

    res.json({
      success: true,
      message: 'Visit request rejected',
      data: { visit_request: result.rows[0] },
    });
  } catch (error) {
    next(error);
  }
};

// Cancel a pending request (Guard/Admin)
exports.cancelRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    // Verify the request exists and is pending
    const request = await pool.query('SELECT * FROM visit_requests WHERE id = $1', [id]);
    if (request.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    const visitReq = request.rows[0];
    if (visitReq.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Request already ${visitReq.status}` });
    }

    // Staff can cancel their own assigned requests, guard/admin can cancel too
    if (req.user.role === 'staff' && visitReq.staff_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You can only cancel your own assigned requests' });
    }

    const result = await pool.query(
      `UPDATE visit_requests SET status = 'cancelled', reject_reason = $1, responded_at = NOW(), updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [reason || 'Cancelled by staff - incorrect details', id]
    );

    // Notify guard that request was cancelled
    const guardResult = await pool.query('SELECT full_name, push_token FROM users WHERE id = $1', [visitReq.guard_id]);
    const visitorResult = await pool.query('SELECT full_name FROM visitors WHERE id = $1', [visitReq.visitor_id]);

    await pool.query(
      `INSERT INTO notifications (user_id, title, body, type, reference_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [visitReq.guard_id, 'Request Cancelled ⚠️', `${req.user.full_name || 'Staff'} cancelled the visit request for ${visitorResult.rows[0]?.full_name || 'visitor'}. ${reason ? 'Reason: ' + reason : 'Please check visitor details.'}`, 'cancellation', id]
    );

    if (guardResult.rows[0]?.push_token) {
      await sendPushNotification(guardResult.rows[0].push_token, 'Request Cancelled ⚠️', `Request for ${visitorResult.rows[0]?.full_name || 'visitor'} was cancelled`, { type: 'cancellation', requestId: id });
    }

    await logActivity(req.user.id, 'cancel_request', 'visit_request', id, { reason });

    res.json({ success: true, message: 'Request cancelled', data: { visit_request: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};

// Get staff approval history (with date filtering, summary counts, response time)
exports.getStaffHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, status, date_from, date_to } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT vr.*, v.full_name as visitor_name, v.phone as visitor_phone, v.photo_url as visitor_photo,
             v.id_type as visitor_id_type, v.id_number as visitor_id_number, v.address as visitor_address,
             g.full_name as guard_name, g.gate_assigned,
             CASE WHEN vr.responded_at IS NOT NULL AND vr.requested_at IS NOT NULL
               THEN EXTRACT(EPOCH FROM (vr.responded_at - vr.requested_at)) / 60.0
               ELSE NULL
             END as response_time_minutes,
             (SELECT COUNT(*) FROM visit_requests vr2 WHERE vr2.visitor_id = vr.visitor_id) as visit_count,
             gp.entry_time, gp.exit_time, gp.sms_sent,
             gp.pass_code, gp.status as pass_status
      FROM visit_requests vr
      JOIN visitors v ON vr.visitor_id = v.id
      JOIN users g ON vr.guard_id = g.id
      LEFT JOIN (
        SELECT DISTINCT ON (visit_request_id) *
        FROM gate_passes
        ORDER BY visit_request_id, created_at DESC
      ) gp ON gp.visit_request_id = vr.id
      WHERE vr.staff_id = $1
    `;
    const params = [req.user.id];

    if (status) {
      if (status === 'approved') {
        query += ` AND (vr.status = 'approved' OR (vr.status = 'expired' AND vr.responded_at IS NOT NULL))`;
      } else if (status === 'expired') {
        query += ` AND vr.status = 'expired' AND vr.responded_at IS NULL`;
      } else {
        params.push(status);
        query += ` AND vr.status = $${params.length}`;
      }
    } else {
      query += ` AND vr.status != 'pending'`;
    }

    // Date filters — IST timezone-aware using a stable timeline field:
    // responded_at for acted requests, otherwise created_at.
    // Avoid using updated_at because cron/status updates can shift records across days.
    if (date_from) {
      params.push(date_from);
      query += ` AND (COALESCE(vr.responded_at, vr.created_at) AT TIME ZONE 'Asia/Kolkata')::date >= $${params.length}::date`;
    }
    if (date_to) {
      params.push(date_to);
      query += ` AND (COALESCE(vr.responded_at, vr.created_at) AT TIME ZONE 'Asia/Kolkata')::date <= $${params.length}::date`;
    }

    // Order by the same stable timeline field used in filtering.
    query += ` ORDER BY COALESCE(vr.responded_at, vr.created_at) DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Also get summary counts for the date range
    let countsQuery = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE vr.status = 'approved' OR (vr.status = 'expired' AND vr.responded_at IS NOT NULL)) as approved,
        COUNT(*) FILTER (WHERE vr.status = 'rejected') as rejected,
        COUNT(*) FILTER (WHERE vr.status = 'pending') as pending,
        COUNT(*) FILTER (WHERE vr.status = 'expired' AND vr.responded_at IS NULL) as expired,
        COUNT(*) FILTER (WHERE vr.status = 'cancelled') as cancelled
      FROM visit_requests vr
      WHERE vr.staff_id = $1
    `;
    const countParams = [req.user.id];

    if (date_from) {
      countParams.push(date_from);
      countsQuery += ` AND (COALESCE(vr.responded_at, vr.created_at) AT TIME ZONE 'Asia/Kolkata')::date >= $${countParams.length}::date`;
    }
    if (date_to) {
      countParams.push(date_to);
      countsQuery += ` AND (COALESCE(vr.responded_at, vr.created_at) AT TIME ZONE 'Asia/Kolkata')::date <= $${countParams.length}::date`;
    }

    const countsResult = await pool.query(countsQuery, countParams);
    const counts = countsResult.rows[0] || {};

    res.json({
      success: true,
      data: {
        history: result.rows,
        summary: {
          total: parseInt(counts.total || 0),
          approved: parseInt(counts.approved || 0),
          rejected: parseInt(counts.rejected || 0),
          pending: parseInt(counts.pending || 0),
          expired: parseInt(counts.expired || 0),
          cancelled: parseInt(counts.cancelled || 0),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Confirm whether visitor actually met the staff (Staff only)
exports.confirmMeeting = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { meeting_status } = req.body;

    if (!['met', 'not_met'].includes(meeting_status)) {
      return res.status(400).json({ success: false, message: "meeting_status must be 'met' or 'not_met'" });
    }

    const request = await pool.query('SELECT * FROM visit_requests WHERE id = $1', [id]);
    if (request.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Visit request not found' });
    }

    const visitReq = request.rows[0];

    if (visitReq.staff_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You can only confirm meetings for your own requests' });
    }

    if (visitReq.status !== 'approved') {
      return res.status(400).json({ success: false, message: 'Meeting confirmation is only available for approved requests' });
    }

    if (visitReq.meeting_status !== 'not_confirmed') {
      return res.status(400).json({ success: false, message: 'Meeting status has already been confirmed' });
    }

    const result = await pool.query(
      `UPDATE visit_requests SET meeting_status = $1, meeting_confirmed_at = NOW(), updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [meeting_status, id]
    );

    // Get visitor name and guard details for notification
    const visitorResult = await pool.query('SELECT full_name FROM visitors WHERE id = $1', [visitReq.visitor_id]);
    const guardResult = await pool.query('SELECT full_name, push_token FROM users WHERE id = $1', [visitReq.guard_id]);
    const guard = guardResult.rows[0];
    const visitorName = visitorResult.rows[0]?.full_name || 'The visitor';

    const metLabel = meeting_status === 'met' ? 'did meet' : 'did NOT meet';
    const icon = meeting_status === 'met' ? '✅' : '⚠️';
    const notifTitle = meeting_status === 'met' ? `Meeting Confirmed ${icon}` : `Visitor Did Not Meet Staff ${icon}`;
    const notifBody = `${req.user.full_name} confirmed that ${visitorName} ${metLabel} them during their campus visit.`;

    // Notify the guard
    await pool.query(
      `INSERT INTO notifications (user_id, title, body, type, reference_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [visitReq.guard_id, notifTitle, notifBody, 'meeting_confirmation', id]
    );

    if (guard?.push_token) {
      const { sendPushNotification } = require('../utils/pushNotification');
      await sendPushNotification(guard.push_token, notifTitle, notifBody, { type: 'meeting_confirmation', requestId: id });
    }

    await logActivity(req.user.id, 'confirm_meeting', 'visit_request', id, { meeting_status, visitor_name: visitorName });

    res.json({
      success: true,
      message: `Meeting status updated: ${meeting_status}`,
      data: { visit_request: result.rows[0] },
    });
  } catch (error) {
    next(error);
  }
};

// Get missed requests for staff (expired without response)
exports.getMissedRequests = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT vr.*, v.full_name as visitor_name, v.phone as visitor_phone, v.photo_url as visitor_photo,
             v.id_type as visitor_id_type, v.id_number as visitor_id_number,
             g.full_name as guard_name, g.gate_assigned
       FROM visit_requests vr
       JOIN visitors v ON vr.visitor_id = v.id
       JOIN users g ON vr.guard_id = g.id
       WHERE vr.staff_id = $1 AND vr.status = 'expired'
       ORDER BY vr.created_at DESC`,
      [req.user.id]
    );

    res.json({ success: true, data: { requests: result.rows } });
  } catch (error) {
    next(error);
  }
};

// Guard date-wise history with date filtering (ALL guards see ALL requests campus-wide)
// Uses IST timezone-aware date filtering to avoid timezone mismatch
exports.getGuardDateHistory = async (req, res, next) => {
  try {
    const { date_from, date_to, status, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    const conditions = [];

    // Auto-expire approved visits past valid_until (except those still inside campus)
    await pool.query(
      `UPDATE visit_requests SET status = 'expired', updated_at = NOW()
       WHERE status = 'approved' AND valid_until IS NOT NULL AND valid_until < NOW()
       AND id NOT IN (SELECT visit_request_id FROM gate_passes WHERE entry_time IS NOT NULL AND exit_time IS NULL AND visit_request_id IS NOT NULL)`
    );
    await pool.query(
      `UPDATE gate_passes SET status = 'expired'
       WHERE status = 'active' AND valid_until < NOW() AND entry_time IS NULL`
    );

    // No guard_id filter — all guards see all requests campus-wide

    // IST-aware date filters: convert created_at to IST before comparing
    if (date_from) {
      conditions.push(`(vr.created_at AT TIME ZONE 'Asia/Kolkata')::date >= $${params.length + 1}::date`);
      params.push(date_from);
    }
    if (date_to) {
      conditions.push(`(vr.created_at AT TIME ZONE 'Asia/Kolkata')::date <= $${params.length + 1}::date`);
      params.push(date_to);
    }
    if (status && status !== 'all') {
      conditions.push(`vr.status = $${params.length + 1}`);
      params.push(status);
    }

    let query = `
      SELECT vr.*, v.full_name as visitor_name, v.phone as visitor_phone, v.photo_url as visitor_photo,
             g.full_name as guard_name, s.full_name as staff_name, s.department as staff_department,
             CASE WHEN vr.responded_at IS NOT NULL AND vr.requested_at IS NOT NULL
               THEN EXTRACT(EPOCH FROM (vr.responded_at - vr.requested_at)) / 60.0
               ELSE NULL
             END as response_time_minutes,
             (SELECT COUNT(*) FROM visit_requests vr2 WHERE vr2.visitor_id = vr.visitor_id) as visit_count,
             gp.entry_time, gp.exit_time, gp.sms_sent, gp.pass_code, gp.status as pass_status
      FROM visit_requests vr
      JOIN visitors v ON vr.visitor_id = v.id
      JOIN users g ON vr.guard_id = g.id
      JOIN users s ON vr.staff_id = s.id
      LEFT JOIN (
        SELECT DISTINCT ON (visit_request_id) * 
        FROM gate_passes 
        ORDER BY visit_request_id, created_at DESC
      ) gp ON gp.visit_request_id = vr.id
    `;

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ` ORDER BY vr.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Also get summary counts for the date range (IST-aware)
    let countsQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'approved') as approved,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'expired') as expired,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
      FROM visit_requests vr
    `;
    const countParams = [];
    const countConditions = [];

    // IST-aware date filters for counts too
    if (date_from) {
      countConditions.push(`(vr.created_at AT TIME ZONE 'Asia/Kolkata')::date >= $${countParams.length + 1}::date`);
      countParams.push(date_from);
    }
    if (date_to) {
      countConditions.push(`(vr.created_at AT TIME ZONE 'Asia/Kolkata')::date <= $${countParams.length + 1}::date`);
      countParams.push(date_to);
    }
    if (countConditions.length > 0) {
      countsQuery += ' WHERE ' + countConditions.join(' AND ');
    }

    const countsResult = await pool.query(countsQuery, countParams);
    const counts = countsResult.rows[0] || {};

    res.json({
      success: true,
      data: {
        visits: result.rows,
        summary: {
          total: parseInt(counts.total || 0),
          approved: parseInt(counts.approved || 0),
          rejected: parseInt(counts.rejected || 0),
          pending: parseInt(counts.pending || 0),
          expired: parseInt(counts.expired || 0),
          cancelled: parseInt(counts.cancelled || 0),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Search visitors across all records (Guard — for lookup)
exports.searchVisitors = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.json({ success: true, data: { visitors: [] } });
    }

    const searchTerm = `%${q.trim()}%`;
    const result = await pool.query(
      `SELECT v.id, v.full_name, v.phone, v.photo_url, v.is_blacklisted, v.blacklist_reason,
              COUNT(vr.id) as total_visits,
              MAX(vr.created_at) as last_visit,
              (SELECT status FROM visit_requests WHERE visitor_id = v.id ORDER BY created_at DESC LIMIT 1) as last_status
       FROM visitors v
       LEFT JOIN visit_requests vr ON v.id = vr.visitor_id
       WHERE v.full_name ILIKE $1 OR v.phone ILIKE $1
       GROUP BY v.id
       ORDER BY MAX(vr.created_at) DESC NULLS LAST
       LIMIT 20`,
      [searchTerm]
    );

    res.json({ success: true, data: { visitors: result.rows } });
  } catch (error) {
    next(error);
  }
};

