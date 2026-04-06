const pool = require('../config/db');

// Create general visit (Guard) — no approval needed
exports.createGeneralVisit = async (req, res, next) => {
  try {
    const { visitor_name, visitor_phone, purpose, purpose_detail, validity_hours = 2, vehicle_number, vehicle_type } = req.body;
    const guard_id = req.user.id;
    const photo_url = req.file ? `/uploads/${req.file.filename}` : null;

    // Check/create visitor
    let visitorResult = await pool.query('SELECT * FROM visitors WHERE phone = $1', [visitor_phone]);
    let visitor;

    if (visitorResult.rows.length > 0) {
      visitor = visitorResult.rows[0];
      if (visitor.is_blacklisted) {
        return res.status(403).json({
          success: false,
          message: `This visitor is blacklisted. Reason: ${visitor.blacklist_reason || 'No reason provided'}`,
        });
      }
      if (photo_url) {
        await pool.query('UPDATE visitors SET photo_url = $1, full_name = $2 WHERE id = $3', [photo_url, visitor_name, visitor.id]);
      }
    } else {
      const newVisitor = await pool.query(
        `INSERT INTO visitors (full_name, phone, photo_url) VALUES ($1, $2, $3) RETURNING *`,
        [visitor_name, visitor_phone, photo_url]
      );
      visitor = newVisitor.rows[0];
    }

    const valid_until = new Date(Date.now() + validity_hours * 60 * 60 * 1000);

    const result = await pool.query(
      `INSERT INTO general_visits (visitor_id, guard_id, purpose, purpose_detail, valid_until, vehicle_number, vehicle_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [visitor.id, guard_id, purpose, purpose_detail, valid_until, vehicle_number || null, vehicle_type || 'none']
    );

    res.status(201).json({
      success: true,
      message: 'General visit pass created',
      data: {
        general_visit: result.rows[0],
        visitor,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get all general visits
exports.getGeneralVisits = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let query = `
      SELECT gv.*, v.full_name as visitor_name, v.phone as visitor_phone, v.photo_url as visitor_photo,
          g.full_name as guard_name
      FROM general_visits gv
      JOIN visitors v ON gv.visitor_id = v.id
      JOIN users g ON gv.guard_id = g.id
    `;
    const params = [];
    const conditions = [];

    if (req.user.role === 'guard') {
      conditions.push(`gv.guard_id = $${params.length + 1}`);
      params.push(req.user.id);
    }
    if (status) {
      conditions.push(`gv.status = $${params.length + 1}`);
      params.push(status);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ` ORDER BY gv.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    res.json({ success: true, data: { visits: result.rows } });
  } catch (error) {
    next(error);
  }
};

// Get single general visit
exports.getGeneralVisit = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT gv.*, v.full_name as visitor_name, v.phone as visitor_phone, v.photo_url as visitor_photo,
              g.full_name as guard_name
       FROM general_visits gv
       JOIN visitors v ON gv.visitor_id = v.id
       JOIN users g ON gv.guard_id = g.id
       WHERE gv.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'General visit not found' });
    }

    res.json({ success: true, data: { general_visit: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};

// Revoke general visit
exports.revokeGeneralVisit = async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE general_visits SET status = 'revoked' WHERE id = $1 AND status = 'approved' RETURNING *`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Visit not found or already expired/revoked' });
    }

    // Also revoke any associated gate pass
    await pool.query(
      `UPDATE gate_passes SET status = 'revoked' WHERE general_visit_id = $1 AND status = 'active'`,
      [req.params.id]
    );

    res.json({ success: true, message: 'General visit revoked', data: { general_visit: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};
