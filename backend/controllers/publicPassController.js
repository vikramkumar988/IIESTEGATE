const pool = require('../config/db');

/**
 * Serve a public HTML page for a gate pass.
 * URL: GET /pass/:pass_code
 * No authentication required — visitor can view their pass via SMS link.
 */
exports.getPublicPass = async (req, res) => {
  try {
    const { pass_code } = req.params;

    const result = await pool.query(
      `SELECT gp.*, v.full_name as visitor_name, v.phone as visitor_phone, v.photo_url as visitor_photo
       FROM gate_passes gp
       JOIN visitors v ON gp.visitor_id = v.id
       WHERE gp.pass_code = $1`,
      [pass_code]
    );

    if (result.rows.length === 0) {
      return res.status(404).send(renderErrorPage('Pass Not Found', 'This gate pass does not exist or has been removed.'));
    }

    const pass = result.rows[0];
    let visitInfo = {};

    if (pass.visit_request_id) {
      const vr = await pool.query(
        `SELECT vr.purpose, s.full_name as staff_name, s.department
         FROM visit_requests vr JOIN users s ON vr.staff_id = s.id WHERE vr.id = $1`,
        [pass.visit_request_id]
      );
      if (vr.rows.length > 0) visitInfo = { ...vr.rows[0], visit_type: 'Professor Visit' };
    } else if (pass.general_visit_id) {
      const gv = await pool.query('SELECT purpose, purpose_detail FROM general_visits WHERE id = $1', [pass.general_visit_id]);
      if (gv.rows.length > 0) visitInfo = { ...gv.rows[0], visit_type: 'General Visit' };
    }

    let statusLabel, statusColor;
    const now = new Date();
    if (pass.status === 'revoked') { statusLabel = 'REVOKED'; statusColor = '#dc2626'; }
    else if (pass.status === 'used') { statusLabel = 'USED'; statusColor = '#6b7280'; }
    else if (pass.status === 'expired' || new Date(pass.valid_until) < now) { statusLabel = 'EXPIRED'; statusColor = '#f59e0b'; }
    else { statusLabel = 'ACTIVE'; statusColor = '#22c55e'; }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>IIEST Gate Pass — ${pass.visitor_name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #e5e5e5; min-height: 100vh; display: flex; justify-content: center; padding: 20px; }
    .container { max-width: 420px; width: 100%; }
    .card { background: #171717; border: 1px solid #262626; border-radius: 16px; overflow: hidden; margin-bottom: 16px; }
    .header { text-align: center; padding: 24px 20px 16px; border-bottom: 1px solid #262626; }
    .logo { font-size: 20px; font-weight: 900; letter-spacing: 1px; color: #a78bfa; }
    .subtitle { font-size: 11px; color: #737373; margin-top: 4px; text-transform: uppercase; letter-spacing: 2px; }
    .status-badge { display: inline-block; padding: 6px 20px; border-radius: 20px; font-size: 13px; font-weight: 800; letter-spacing: 2px; margin-top: 12px; background: ${statusColor}20; color: ${statusColor}; border: 1px solid ${statusColor}40; }
    .qr-section { text-align: center; padding: 24px; }
    .qr-img { width: 200px; height: 200px; border-radius: 12px; background: #fff; padding: 8px; }
    .qr-code-text { font-size: 11px; color: #737373; margin-top: 8px; font-family: monospace; letter-spacing: 1px; }
    .info-section { padding: 0 20px 20px; }
    .info-row { display: flex; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid #1f1f1f; }
    .info-row:last-child { border-bottom: none; }
    .info-icon { font-size: 16px; margin-right: 10px; min-width: 22px; }
    .info-label { font-size: 10px; color: #737373; text-transform: uppercase; letter-spacing: 1px; }
    .info-value { font-size: 14px; color: #e5e5e5; font-weight: 600; margin-top: 2px; }
    .footer { text-align: center; padding: 16px; font-size: 10px; color: #525252; }
    .visitor-photo { width: 80px; height: 100px; border-radius: 8px; object-fit: cover; margin: 0 auto 12px; display: block; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div class="logo">IIEST E-GATE PASS</div>
        <div class="subtitle">Indian Institute of Engineering Science & Technology</div>
        <div class="status-badge">${statusLabel}</div>
      </div>

      <div class="qr-section">
        ${pass.visitor_photo ? `<img src="${pass.visitor_photo}" class="visitor-photo" alt="Visitor Photo" />` : ''}
        ${pass.qr_data ? `<img src="${pass.qr_data}" class="qr-img" alt="QR Code" />` : '<p style="color:#737373">QR Code</p>'}
        <div class="qr-code-text">${pass.pass_code}</div>
      </div>

      <div class="info-section">
        <div class="info-row">
          <span class="info-icon">👤</span>
          <div><div class="info-label">Visitor</div><div class="info-value">${pass.visitor_name}</div></div>
        </div>
        <div class="info-row">
          <span class="info-icon">📱</span>
          <div><div class="info-label">Phone</div><div class="info-value">${pass.visitor_phone}</div></div>
        </div>
        ${visitInfo.visit_type ? `
        <div class="info-row">
          <span class="info-icon">📋</span>
          <div><div class="info-label">Visit Type</div><div class="info-value">${visitInfo.visit_type}</div></div>
        </div>` : ''}
        ${visitInfo.purpose ? `
        <div class="info-row">
          <span class="info-icon">🎯</span>
          <div><div class="info-label">Purpose</div><div class="info-value">${visitInfo.purpose}</div></div>
        </div>` : ''}
        ${visitInfo.staff_name ? `
        <div class="info-row">
          <span class="info-icon">🎓</span>
          <div><div class="info-label">Visiting</div><div class="info-value">${visitInfo.staff_name} — ${visitInfo.department || ''}</div></div>
        </div>` : ''}
        <div class="info-row">
          <span class="info-icon">⏰</span>
          <div><div class="info-label">Valid Until</div><div class="info-value">${new Date(pass.valid_until).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div></div>
        </div>
        ${pass.entry_time ? `
        <div class="info-row">
          <span class="info-icon">🚪</span>
          <div><div class="info-label">Entered</div><div class="info-value">${new Date(pass.entry_time).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div></div>
        </div>` : ''}
      </div>
    </div>
    <div class="footer">Show this pass at the campus gate • IIEST E-Gate Pass System</div>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Public pass page error:', error);
    res.status(500).send(renderErrorPage('Server Error', 'An unexpected error occurred.'));
  }
};

function renderErrorPage(title, message) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — IIEST Gate Pass</title>
<style>body{font-family:-apple-system,sans-serif;background:#0a0a0a;color:#e5e5e5;display:flex;justify-content:center;align-items:center;min-height:100vh;text-align:center;padding:20px}
.box{background:#171717;border:1px solid #262626;border-radius:16px;padding:40px;max-width:400px}
h1{font-size:22px;color:#ef4444;margin-bottom:8px}p{color:#737373;font-size:14px}</style>
</head><body><div class="box"><h1>${title}</h1><p>${message}</p></div></body></html>`;
}
