const pool = require('../config/db');
const { generatePassCode, generateQRCode } = require('../utils/qrGenerator');
const { sendPassSMS } = require('../utils/smsService');

// Generate QR code for approved visit request
exports.generatePass = async (req, res, next) => {
  try {
    const { visitId } = req.params;
    const guard_id = req.user.id;

    // Check if visit request exists and is approved
    const visitResult = await pool.query(
      `SELECT vr.*, v.full_name as visitor_name, v.phone as visitor_phone
       FROM visit_requests vr
       JOIN visitors v ON vr.visitor_id = v.id
       WHERE vr.id = $1`,
      [visitId]
    );

    if (visitResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Visit request not found' });
    }

    const visit = visitResult.rows[0];

    if (visit.status !== 'approved') {
      return res.status(400).json({ success: false, message: 'Visit request is not approved' });
    }

    // Check if pass already exists
    const existingPass = await pool.query(
      'SELECT * FROM gate_passes WHERE visit_request_id = $1 AND status = $2',
      [visitId, 'active']
    );

    if (existingPass.rows.length > 0) {
      return res.json({
        success: true,
        message: 'Pass already exists',
        data: { gate_pass: existingPass.rows[0] },
      });
    }

    const pass_code = generatePassCode();
    const valid_until = visit.valid_until || new Date(Date.now() + 4 * 60 * 60 * 1000);

    const qrPayload = {
      pass_code,
      visitor_name: visit.visitor_name,
      visitor_phone: visit.visitor_phone,
      visit_type: 'professor_visit',
      valid_until: valid_until.toISOString(),
    };

    const qr_data = await generateQRCode(qrPayload);

    const result = await pool.query(
      `INSERT INTO gate_passes (pass_code, visit_request_id, visitor_id, generated_by, qr_data, status, valid_until)
       VALUES ($1, $2, $3, $4, $5, 'active', $6) RETURNING *`,
      [pass_code, visitId, visit.visitor_id, guard_id, qr_data, valid_until]
    );

    // Send SMS with pass link to visitor
    try {
      const smsResult = await sendPassSMS(visit.visitor_phone, pass_code, visit.visitor_name);
      if (smsResult.success) {
        await pool.query('UPDATE gate_passes SET sms_sent = true, sms_sent_at = NOW() WHERE id = $1', [result.rows[0].id]);
      }
    } catch (smsErr) { console.log('SMS send error (non-fatal):', smsErr.message); }

    res.status(201).json({
      success: true,
      message: 'Gate pass generated successfully',
      data: { gate_pass: result.rows[0] },
    });
  } catch (error) {
    next(error);
  }
};

// Generate QR for general visit
exports.generateGeneralPass = async (req, res, next) => {
  try {
    const { generalVisitId } = req.params;
    const guard_id = req.user.id;

    const visitResult = await pool.query(
      `SELECT gv.*, v.full_name as visitor_name, v.phone as visitor_phone
       FROM general_visits gv
       JOIN visitors v ON gv.visitor_id = v.id
       WHERE gv.id = $1`,
      [generalVisitId]
    );

    if (visitResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'General visit not found' });
    }

    const visit = visitResult.rows[0];

    if (visit.status !== 'approved') {
      return res.status(400).json({ success: false, message: 'Visit is not active' });
    }

    // Check if pass already exists
    const existingPass = await pool.query(
      'SELECT * FROM gate_passes WHERE general_visit_id = $1 AND status = $2',
      [generalVisitId, 'active']
    );

    if (existingPass.rows.length > 0) {
      return res.json({
        success: true,
        message: 'Pass already exists',
        data: { gate_pass: existingPass.rows[0] },
      });
    }

    const pass_code = generatePassCode();
    const qrPayload = {
      pass_code,
      visitor_name: visit.visitor_name,
      visitor_phone: visit.visitor_phone,
      visit_type: 'general',
      purpose: visit.purpose,
      valid_until: visit.valid_until,
    };

    const qr_data = await generateQRCode(qrPayload);

    const result = await pool.query(
      `INSERT INTO gate_passes (pass_code, general_visit_id, visitor_id, generated_by, qr_data, status, valid_until)
       VALUES ($1, $2, $3, $4, $5, 'active', $6) RETURNING *`,
      [pass_code, generalVisitId, visit.visitor_id, guard_id, qr_data, visit.valid_until]
    );

    // Send SMS with pass link to visitor
    try {
      const smsResult = await sendPassSMS(visit.visitor_phone, pass_code, visit.visitor_name);
      if (smsResult.success) {
        await pool.query('UPDATE gate_passes SET sms_sent = true, sms_sent_at = NOW() WHERE id = $1', [result.rows[0].id]);
      }
    } catch (smsErr) { console.log('SMS send error (non-fatal):', smsErr.message); }

    res.status(201).json({
      success: true,
      message: 'General visit pass generated',
      data: { gate_pass: result.rows[0] },
    });
  } catch (error) {
    next(error);
  }
};

// Verify QR code (any guard can scan)
// scan_mode: 'entry' | 'exit' | 'verify' (default: 'verify')
exports.verifyPass = async (req, res, next) => {
  try {
    const { pass_code, scan_mode = 'verify', location } = req.body;

    if (!pass_code) {
      return res.status(400).json({ success: false, message: 'Pass code is required' });
    }

    // 1. Check for active lockdown FIRST
    const lockdownResult = await pool.query(
      `SELECT id, reason, activated_at FROM campus_lockdowns WHERE is_active = true LIMIT 1`
    );
    if (lockdownResult.rows.length > 0) {
      const lockdown = lockdownResult.rows[0];
      // Log the scan attempt during lockdown
      const passLookup = await pool.query('SELECT id FROM gate_passes WHERE pass_code = $1', [pass_code]);
      if (passLookup.rows.length > 0) {
        await pool.query(
          `INSERT INTO scan_logs (gate_pass_id, scanned_by, scan_type, scan_result, location) VALUES ($1, $2, $3, $4, $5)`,
          [passLookup.rows[0].id, req.user.id, scan_mode, 'lockdown', location || 'Unknown']
        );
      }
      return res.json({
        success: true,
        data: {
          status: 'lockdown',
          message: 'Campus is under lockdown. All entry/exit is suspended.',
          lockdown_reason: lockdown.reason,
          lockdown_since: lockdown.activated_at,
        },
      });
    }

    // 2. Fetch pass with visitor details including blacklist status
    const result = await pool.query(
      `SELECT gp.*, v.full_name as visitor_name, v.phone as visitor_phone, v.photo_url as visitor_photo,
              v.is_blacklisted, v.blacklist_reason, v.id_card_photo_url
       FROM gate_passes gp
       JOIN visitors v ON gp.visitor_id = v.id
       WHERE gp.pass_code = $1`,
      [pass_code]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: { status: 'invalid', message: 'QR code not found in system' },
      });
    }

    const pass = result.rows[0];

    // 3. Check blacklist
    if (pass.is_blacklisted) {
      await pool.query(
        `INSERT INTO scan_logs (gate_pass_id, scanned_by, scan_type, scan_result, location) VALUES ($1, $2, $3, $4, $5)`,
        [pass.id, req.user.id, scan_mode, 'blacklisted', location || 'Unknown']
      );
      return res.json({
        success: true,
        data: {
          status: 'blacklisted',
          message: `This visitor is BLACKLISTED.`,
          blacklist_reason: pass.blacklist_reason || 'No reason provided',
          pass: {
            visitor_name: pass.visitor_name,
            visitor_phone: pass.visitor_phone,
            visitor_photo: pass.visitor_photo,
          },
        },
      });
    }

    // 4. Get visit details (purpose, staff, meeting status)
    let visitInfo = {};
    if (pass.visit_request_id) {
      const visitResult = await pool.query(
        `SELECT vr.purpose, vr.notes, vr.meeting_status, vr.meeting_confirmed_at,
                s.full_name as staff_name, s.department
         FROM visit_requests vr
         JOIN users s ON vr.staff_id = s.id
         WHERE vr.id = $1`,
        [pass.visit_request_id]
      );
      if (visitResult.rows.length > 0) {
        visitInfo = { ...visitResult.rows[0], visit_type: 'professor_visit' };
      }
    } else if (pass.general_visit_id) {
      const gvResult = await pool.query(
        'SELECT purpose, purpose_detail, vehicle_number, vehicle_type FROM general_visits WHERE id = $1',
        [pass.general_visit_id]
      );
      if (gvResult.rows.length > 0) {
        visitInfo = { ...gvResult.rows[0], visit_type: 'general' };
      }
    }

    // 5. Check validity
    let verificationStatus;
    if (pass.status === 'revoked') {
      verificationStatus = 'revoked';
    } else if (pass.status === 'expired' || new Date(pass.valid_until) < new Date()) {
      verificationStatus = 'expired';
      if (pass.status === 'active') {
        await pool.query("UPDATE gate_passes SET status = 'expired' WHERE id = $1", [pass.id]);
      }
    } else if (pass.status === 'used') {
      verificationStatus = 'used';
    } else if (pass.status === 'active') {
      verificationStatus = 'valid';
    } else {
      verificationStatus = pass.status;
    }

    // 6. Handle scan_mode actions
    let scanAction = null;
    let duration = null;

    if (scan_mode === 'entry' && verificationStatus === 'valid') {
      if (pass.entry_time) {
        scanAction = 'already_entered';
      } else {
        await pool.query('UPDATE gate_passes SET entry_time = NOW() WHERE id = $1', [pass.id]);
        pass.entry_time = new Date();
        scanAction = 'entry_recorded';
      }
    } else if (scan_mode === 'exit') {
      if (!pass.entry_time) {
        scanAction = 'no_entry_record';
      } else if (pass.exit_time) {
        scanAction = 'already_exited';
      } else {
        const exitResult = await pool.query(
          `UPDATE gate_passes SET exit_time = NOW(), status = 'used' WHERE id = $1 RETURNING exit_time`,
          [pass.id]
        );
        pass.exit_time = exitResult.rows[0].exit_time;
        verificationStatus = 'used';
        scanAction = 'exit_recorded';
        // Calculate duration
        const entryMs = new Date(pass.entry_time).getTime();
        const exitMs = new Date(pass.exit_time).getTime();
        const diffMs = exitMs - entryMs;
        const hours = Math.floor(diffMs / 3600000);
        const mins = Math.floor((diffMs % 3600000) / 60000);
        duration = `${hours}h ${mins}m`;
      }
    }

    // 7. Gate mismatch check
    let gate_mismatch = false;
    let gate_warning = null;
    if (req.user.gate_assigned) {
      // Check if the QR payload has an allowed_gate
      try {
        const qrPayload = JSON.parse(Buffer.from(pass.qr_data, 'base64').toString());
        if (qrPayload.allowed_gate && qrPayload.allowed_gate !== req.user.gate_assigned) {
          gate_mismatch = true;
          gate_warning = `This pass is for ${qrPayload.allowed_gate} — you are at ${req.user.gate_assigned}`;
        }
      } catch (e) { /* QR data might not be JSON base64 — skip */ }
    }

    // 8. Log the scan
    const scanResult = scanAction || verificationStatus;
    await pool.query(
      `INSERT INTO scan_logs (gate_pass_id, scanned_by, scan_type, scan_result, location) VALUES ($1, $2, $3, $4, $5)`,
      [pass.id, req.user.id, scan_mode, scanResult, location || 'Unknown']
    );

    res.json({
      success: true,
      data: {
        status: verificationStatus,
        scan_action: scanAction,
        duration,
        gate_mismatch,
        gate_warning,
        pass: {
          id: pass.id,
          pass_code: pass.pass_code,
          visitor_name: pass.visitor_name,
          visitor_phone: pass.visitor_phone,
          visitor_photo: pass.visitor_photo,
          id_card_photo_url: pass.id_card_photo_url,
          entry_time: pass.entry_time,
          exit_time: pass.exit_time,
          valid_until: pass.valid_until,
          created_at: pass.created_at,
        },
        visit: visitInfo,
      },
    });
  } catch (error) {
    next(error);
  }
};


// Get pass details
exports.getPass = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT gp.*, v.full_name as visitor_name, v.phone as visitor_phone, v.photo_url as visitor_photo
        FROM gate_passes gp
        JOIN visitors v ON gp.visitor_id = v.id
        WHERE gp.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Pass not found' });
    }

    res.json({ success: true, data: { gate_pass: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};

// List all passes
exports.getPasses = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let query = `
      SELECT gp.*, v.full_name as visitor_name, v.phone as visitor_phone,
            u.full_name as generated_by_name
      FROM gate_passes gp
      JOIN visitors v ON gp.visitor_id = v.id
      JOIN users u ON gp.generated_by = u.id
    `;
    const params = [];

    if (status) {
      query += ` WHERE gp.status = $1`;
      params.push(status);
    }

    query += ` ORDER BY gp.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);
    res.json({ success: true, data: { passes: result.rows } });
  } catch (error) {
    next(error);
  }
};

// Revoke a pass
exports.revokePass = async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE gate_passes SET status = 'revoked' WHERE id = $1 AND status = 'active' RETURNING *`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Pass not found or not active' });
    }

    res.json({ success: true, message: 'Pass revoked', data: { gate_pass: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};

// Send (or resend) SMS for an existing gate pass (Guard)
exports.sendPassSMSManual = async (req, res, next) => {
  try {
    const { passId } = req.params;

    const result = await pool.query(
      `SELECT gp.*, v.full_name as visitor_name, v.phone as visitor_phone
       FROM gate_passes gp
       JOIN visitors v ON gp.visitor_id = v.id
       WHERE gp.id = $1`,
      [passId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Gate pass not found' });
    }

    const pass = result.rows[0];

    if (pass.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Can only send SMS for active passes' });
    }

    try {
      const smsResult = await sendPassSMS(pass.visitor_phone, pass.pass_code, pass.visitor_name);
      if (smsResult.success) {
        await pool.query('UPDATE gate_passes SET sms_sent = true, sms_sent_at = NOW() WHERE id = $1', [passId]);
        return res.json({ success: true, message: 'SMS sent successfully to ' + pass.visitor_phone });
      } else {
        return res.json({ success: false, message: smsResult.message || 'SMS service returned an error' });
      }
    } catch (smsErr) {
      return res.status(500).json({ success: false, message: 'SMS delivery failed: ' + smsErr.message });
    }
  } catch (error) {
    next(error);
  }
};

// Log exit (scanned at exit gate)
exports.logExit = async (req, res, next) => {
  try {
    const { pass_code, location } = req.body;

    const result = await pool.query(
      `UPDATE gate_passes SET exit_time = NOW(), status = 'used' WHERE pass_code = $1 AND status = 'active' RETURNING *`,
      [pass_code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Active pass not found' });
    }

    await pool.query(
      `INSERT INTO scan_logs (gate_pass_id, scanned_by, scan_type, scan_result, location)
        VALUES ($1, $2, 'exit', 'valid', $3)`,
      [result.rows[0].id, req.user.id, location || 'Exit Gate']
    );

    res.json({ success: true, message: 'Exit logged', data: { gate_pass: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};
