const pool = require('../config/db');

/**
 * Log an activity to the activity_logs table
 * @param {string} userId - UUID of the user performing the action
 * @param {string} action - Action description (e.g., 'edit_visit_request', 'approve_user')
 * @param {string} entityType - Type of entity (e.g., 'visit_request', 'user', 'gate_pass')
 * @param {string} entityId - UUID of the entity
 * @param {object} details - Additional details (stored as JSONB)
 */
const logActivity = async (userId, action, entityType, entityId, details = {}) => {
  try {
    await pool.query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, action, entityType, entityId, JSON.stringify(details)]
    );
  } catch (error) {
    console.error('Activity log error:', error.message);
  }
};

module.exports = { logActivity };
