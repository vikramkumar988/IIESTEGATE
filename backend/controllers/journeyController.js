const pool = require('../config/db');
const { logActivity } = require('../utils/activityLogger');

// Get active journey for a visitor
exports.getActiveJourney = async (req, res, next) => {
  try {
    const { visitorId } = req.params;

    const result = await pool.query(
      `SELECT vj.*, v.full_name as visitor_name, v.phone as visitor_phone, v.photo_url as visitor_photo
       FROM visitor_journeys vj
       JOIN visitors v ON vj.visitor_id = v.id
       WHERE vj.visitor_id = $1 AND vj.status = 'active'
       ORDER BY vj.created_at DESC LIMIT 1`,
      [visitorId]
    );

    if (result.rows.length === 0) {
      return res.json({ success: true, data: { journey: null } });
    }

    const journey = result.rows[0];

    // Get all stops
    const stopsResult = await pool.query(
      `SELECT js.*, 
              s.full_name as staff_name, s.department as staff_department, s.designation as staff_designation,
              r.full_name as referred_by_name
       FROM journey_stops js
       JOIN users s ON js.staff_id = s.id
       LEFT JOIN users r ON js.referred_by = r.id
       WHERE js.journey_id = $1
       ORDER BY js.stop_number ASC`,
      [journey.id]
    );

    res.json({
      success: true,
      data: {
        journey: { ...journey, stops: stopsResult.rows },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get journey by ID with full timeline
exports.getJourney = async (req, res, next) => {
  try {
    const { journeyId } = req.params;

    const result = await pool.query(
      `SELECT vj.*, v.full_name as visitor_name, v.phone as visitor_phone, v.photo_url as visitor_photo
       FROM visitor_journeys vj
       JOIN visitors v ON vj.visitor_id = v.id
       WHERE vj.id = $1`,
      [journeyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Journey not found' });
    }

    const journey = result.rows[0];

    // Get all stops with full details
    const stopsResult = await pool.query(
      `SELECT js.*,
              s.full_name as staff_name, s.department as staff_department, s.designation as staff_designation,
              r.full_name as referred_by_name, r.department as referred_by_department,
              vr.purpose as visit_purpose, vr.status as visit_status
       FROM journey_stops js
       JOIN users s ON js.staff_id = s.id
       LEFT JOIN users r ON js.referred_by = r.id
       LEFT JOIN visit_requests vr ON js.visit_request_id = vr.id
       WHERE js.journey_id = $1
       ORDER BY js.stop_number ASC`,
      [journeyId]
    );

    // Get scan logs for all passes in this journey
    const passIds = stopsResult.rows
      .filter(s => s.gate_pass_id)
      .map(s => s.gate_pass_id);
    
    let scanLogs = [];
    if (passIds.length > 0) {
      const scanResult = await pool.query(
        `SELECT sl.*, u.full_name as scanned_by_name, u.gate_assigned
         FROM scan_logs sl
         JOIN users u ON sl.scanned_by = u.id
         WHERE sl.gate_pass_id = ANY($1)
         ORDER BY sl.scanned_at ASC`,
        [passIds]
      );
      scanLogs = scanResult.rows;
    }

    // Also get initial pass scan logs
    const initialScanResult = await pool.query(
      `SELECT sl.*, u.full_name as scanned_by_name, u.gate_assigned
       FROM scan_logs sl
       JOIN users u ON sl.scanned_by = u.id
       WHERE sl.gate_pass_id = $1
       ORDER BY sl.scanned_at ASC`,
      [journey.initial_pass_id]
    );

    res.json({
      success: true,
      data: {
        journey: {
          ...journey,
          stops: stopsResult.rows,
          scan_logs: [...initialScanResult.rows, ...scanLogs],
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get journey timeline for a visit request
exports.getJourneyByVisitRequest = async (req, res, next) => {
  try {
    const { visitRequestId } = req.params;

    // Find the journey linked to this visit request
    const vrResult = await pool.query(
      `SELECT journey_id FROM visit_requests WHERE id = $1`,
      [visitRequestId]
    );

    if (vrResult.rows.length === 0 || !vrResult.rows[0].journey_id) {
      // Try to find via journey_stops
      const stopResult = await pool.query(
        `SELECT journey_id FROM journey_stops WHERE visit_request_id = $1 LIMIT 1`,
        [visitRequestId]
      );

      if (stopResult.rows.length === 0) {
        return res.json({ success: true, data: { journey: null } });
      }

      req.params.journeyId = stopResult.rows[0].journey_id;
      return exports.getJourney(req, res, next);
    }

    req.params.journeyId = vrResult.rows[0].journey_id;
    return exports.getJourney(req, res, next);
  } catch (error) {
    next(error);
  }
};

// Get all journeys for a visitor (history)
exports.getVisitorJourneys = async (req, res, next) => {
  try {
    const { visitorId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT vj.*,
              (SELECT COUNT(*) FROM journey_stops WHERE journey_id = vj.id) as stop_count,
              (SELECT string_agg(s.full_name, ', ' ORDER BY js.stop_number) 
               FROM journey_stops js JOIN users s ON js.staff_id = s.id 
               WHERE js.journey_id = vj.id) as staff_visited
       FROM visitor_journeys vj
       WHERE vj.visitor_id = $1
       ORDER BY vj.created_at DESC
       LIMIT $2 OFFSET $3`,
      [visitorId, parseInt(limit), parseInt(offset)]
    );

    res.json({ success: true, data: { journeys: result.rows } });
  } catch (error) {
    next(error);
  }
};
