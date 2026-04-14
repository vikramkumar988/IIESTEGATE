const pool = require('../config/db');
const { sendPushNotification } = require('../utils/pushNotification');
const { logActivity } = require('../utils/activityLogger');

// Create incident report (Guard / Staff)
exports.createIncident = async (req, res, next) => {
  try {
    const { category, title, description, photo_base64, location, severity } = req.body;

    if (!category || !description) {
      return res.status(400).json({ success: false, message: 'Category and description are required' });
    }

    // Handle optional base64 photo
    let photoUrl = null;
    if (photo_base64 && photo_base64.startsWith('data:image')) {
      const fs = require('fs');
      const path = require('path');
      const ext = photo_base64.includes('png') ? 'png' : 'jpg';
      const filename = `incident_${Date.now()}.${ext}`;
      const filepath = path.join(__dirname, '..', 'uploads', filename);
      const base64Data = photo_base64.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(filepath, base64Data, 'base64');
      photoUrl = `/uploads/${filename}`;
    }

    const result = await pool.query(
      `INSERT INTO incidents (reported_by, category, title, description, photo_url, location, severity)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.user.id, category, title || `${category} incident`, description, photoUrl, location || null, severity || 'medium']
    );

    const incident = result.rows[0];

    // Notify all admins about the new incident
    const admins = await pool.query(
      `SELECT id, push_token FROM users WHERE role = 'admin' AND is_active = true AND push_token IS NOT NULL`
    );
    for (const admin of admins.rows) {
      try {
        await sendPushNotification(
          admin.push_token,
          `🚨 Incident Report: ${category.toUpperCase()}`,
          `${req.user.full_name} reported: ${description.substring(0, 100)}${description.length > 100 ? '...' : ''}`
        );
      } catch (e) { /* continue */ }
      await pool.query(
        `INSERT INTO notifications (user_id, title, body, type, reference_id) VALUES ($1, $2, $3, $4, $5)`,
        [admin.id, `🚨 Incident: ${category}`, description.substring(0, 200), 'incident', incident.id]
      );
    }

    await logActivity(req.user.id, 'report_incident', 'incident', incident.id, { category, severity });

    res.status(201).json({ success: true, message: 'Incident reported successfully', data: { incident } });
  } catch (error) {
    next(error);
  }
};

// Get all incidents (Admin) with filters
exports.getIncidents = async (req, res, next) => {
  try {
    const { page = 1, limit = 30, category, resolved, date_from, date_to } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    const conditions = [];

    if (category) {
      conditions.push(`i.category = $${params.length + 1}`);
      params.push(category);
    }
    if (resolved !== undefined) {
      conditions.push(`i.is_resolved = $${params.length + 1}`);
      params.push(resolved === 'true');
    }
    if (date_from) {
      conditions.push(`i.created_at >= $${params.length + 1}`);
      params.push(new Date(date_from));
    }
    if (date_to) {
      const to = new Date(date_to);
      to.setHours(23, 59, 59, 999);
      conditions.push(`i.created_at <= $${params.length + 1}`);
      params.push(to);
    }

    let query = `
      SELECT i.*, u.full_name as reporter_name, u.role as reporter_role, u.gate_assigned,
             r.full_name as resolver_name
      FROM incidents i
      JOIN users u ON i.reported_by = u.id
      LEFT JOIN users r ON i.resolved_by = r.id
    `;

    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ` ORDER BY i.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Total count
    let countQuery = 'SELECT COUNT(*) FROM incidents i';
    if (conditions.length > 0) countQuery += ' WHERE ' + conditions.join(' AND ');
    const countResult = await pool.query(countQuery, params.slice(0, -2));

    res.json({
      success: true,
      data: {
        incidents: result.rows,
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

// Get single incident
exports.getIncidentById = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT i.*, u.full_name as reporter_name, u.role as reporter_role, u.gate_assigned,
              r.full_name as resolver_name
       FROM incidents i
       JOIN users u ON i.reported_by = u.id
       LEFT JOIN users r ON i.resolved_by = r.id
       WHERE i.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }
    res.json({ success: true, data: { incident: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};

// Resolve incident (Admin)
exports.resolveIncident = async (req, res, next) => {
  try {
    const { notes } = req.body;
    const result = await pool.query(
      `UPDATE incidents SET is_resolved = true, resolved_by = $1, resolved_at = NOW(), resolved_notes = $2, updated_at = NOW()
       WHERE id = $3 AND is_resolved = false RETURNING *`,
      [req.user.id, notes || 'Resolved', req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Incident not found or already resolved' });
    }

    // Notify the reporter
    const incident = result.rows[0];
    const reporter = await pool.query('SELECT push_token FROM users WHERE id = $1', [incident.reported_by]);
    if (reporter.rows[0]?.push_token) {
      try {
        await sendPushNotification(reporter.rows[0].push_token, '✅ Incident Resolved', `Your ${incident.category} incident report has been resolved.`);
      } catch (e) { /* continue */ }
    }

    await logActivity(req.user.id, 'resolve_incident', 'incident', incident.id, { notes });

    res.json({ success: true, message: 'Incident resolved', data: { incident } });
  } catch (error) {
    next(error);
  }
};
