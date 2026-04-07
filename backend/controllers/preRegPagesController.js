const pool = require('../config/db');

/**
 * Public HTML pages for visitor pre-registration.
 * Same design pattern as publicPassController.js.
 */

// GET /pre-register — The registration form page
exports.renderFormPage = async (req, res) => {
  try {
    // Get staff list for dropdown
    const staffResult = await pool.query(
      `SELECT id, full_name, department, designation
       FROM users WHERE role = 'staff' AND is_active = true AND is_approved = true
       ORDER BY full_name ASC`
    );
    const staffOptions = staffResult.rows.map(s =>
      `<option value="${s.id}">${s.full_name} — ${s.department || s.designation || 'Staff'}</option>`
    ).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pre-Register Visit — IIEST Shibpur</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #e5e5e5; min-height: 100vh; display: flex; justify-content: center; padding: 20px; }
    .container { max-width: 480px; width: 100%; }
    .card { background: #171717; border: 1px solid #262626; border-radius: 16px; overflow: hidden; margin-bottom: 16px; }
    .header { text-align: center; padding: 28px 20px 20px; border-bottom: 1px solid #262626; background: linear-gradient(135deg, #171717 0%, #1a1025 100%); }
    .logo { font-size: 22px; font-weight: 900; letter-spacing: 1px; color: #a78bfa; }
    .subtitle { font-size: 11px; color: #737373; margin-top: 4px; text-transform: uppercase; letter-spacing: 2px; }
    .tagline { font-size: 13px; color: #a3a3a3; margin-top: 12px; }
    .form-section { padding: 24px 20px; }
    .form-group { margin-bottom: 18px; }
    .form-label { display: block; font-size: 11px; color: #a3a3a3; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; font-weight: 600; }
    .form-required::after { content: ' *'; color: #ef4444; }
    .form-input, .form-select, .form-textarea {
      width: 100%; padding: 12px 14px; background: #0a0a0a; border: 1px solid #333; border-radius: 10px;
      color: #e5e5e5; font-size: 14px; font-family: inherit; outline: none; transition: border-color 0.2s;
    }
    .form-input:focus, .form-select:focus, .form-textarea:focus { border-color: #a78bfa; }
    .form-select { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23737373' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 14px center; }
    .form-select option { background: #171717; color: #e5e5e5; }
    .form-textarea { min-height: 70px; resize: vertical; }
    .form-row { display: flex; gap: 12px; }
    .form-row .form-group { flex: 1; }
    .photo-upload { position: relative; }
    .photo-preview { width: 100%; min-height: 160px; border: 2px dashed #333; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; transition: border-color 0.2s; overflow: hidden; background: #0f0f0f; }
    .photo-preview.has-photo { border-color: #22c55e; border-style: solid; }
    .photo-preview img { width: 100%; max-height: 240px; object-fit: cover; }
    .photo-preview .placeholder { text-align: center; padding: 20px; }
    .photo-preview .placeholder-icon { font-size: 32px; margin-bottom: 4px; }
    .photo-preview .placeholder-text { font-size: 12px; color: #737373; }
    .photo-buttons { display: flex; gap: 10px; margin-top: 8px; }
    .photo-btn { flex: 1; padding: 10px 8px; border-radius: 10px; border: 1px solid #333; background: #1a1a1a; color: #e5e5e5; font-size: 13px; font-weight: 600; cursor: pointer; text-align: center; font-family: inherit; transition: all 0.2s; }
    .photo-btn:hover { border-color: #a78bfa; background: #222; }
    .photo-btn:active { transform: scale(0.98); }
    .hidden-input { width: 0.1px; height: 0.1px; opacity: 0; overflow: hidden; position: absolute; z-index: -1; }
    .submit-btn {
      width: 100%; padding: 14px; background: linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%);
      color: #fff; font-size: 15px; font-weight: 800; border: none; border-radius: 12px; cursor: pointer;
      letter-spacing: 0.5px; transition: opacity 0.2s;
    }
    .submit-btn:hover { opacity: 0.9; }
    .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .footer { text-align: center; padding: 16px; font-size: 10px; color: #525252; }
    .error-msg { background: #ef444420; color: #ef4444; border: 1px solid #ef444440; padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 16px; display: none; }
    .spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid #fff4; border-top-color: #fff; border-radius: 50%; animation: spin 0.6s linear infinite; margin-right: 8px; vertical-align: middle; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .info-box { background: #a78bfa15; border: 1px solid #a78bfa30; border-radius: 10px; padding: 12px 14px; margin-bottom: 18px; }
    .info-box p { font-size: 12px; color: #a3a3a3; line-height: 1.5; }
    .info-box strong { color: #a78bfa; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div class="logo">IIEST PRE-REGISTRATION</div>
        <div class="subtitle">Indian Institute of Engineering Science & Technology</div>
        <div class="tagline">Request your campus visit pass in advance</div>
      </div>
      <div class="form-section">
        <div class="info-box">
          <p>📋 Fill in your details below to <strong>pre-register your visit</strong>. The staff member will review your request and approve it. Once approved, you'll receive a <strong>QR code</strong> to show at the gate.</p>
        </div>
        <div id="errorMsg" class="error-msg"></div>
        <form id="preRegForm">
          <div class="form-group">
            <label class="form-label form-required">Your Full Name</label>
            <input type="text" name="visitor_name" class="form-input" placeholder="e.g. Ravi Kumar" required>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label form-required">Phone Number</label>
              <input type="tel" name="visitor_phone" class="form-input" placeholder="10-digit number" required>
            </div>
            <div class="form-group">
              <label class="form-label">Email</label>
              <input type="email" name="visitor_email" class="form-input" placeholder="Optional">
            </div>
          </div>
          <div class="form-group photo-upload">
            <label class="form-label form-required">Your Photo</label>
            <div class="photo-preview" id="photoPreview">
              <div class="placeholder" id="photoPlaceholder">
                <div class="placeholder-icon">📷</div>
                <div class="placeholder-text">Take a photo or choose from gallery</div>
              </div>
            </div>
            <div class="photo-buttons">
              <label for="cameraInput" class="photo-btn">📸 Camera</label>
              <label for="galleryInput" class="photo-btn">🖼️ Gallery</label>
            </div>
            <input type="file" accept="image/*" capture="user" class="hidden-input" id="cameraInput">
            <input type="file" accept="image/jpeg,image/png,image/webp,image/*" class="hidden-input" id="galleryInput">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">ID Type</label>
              <select name="visitor_id_type" class="form-select">
                <option value="">Select</option>
                <option>Aadhaar</option>
                <option>PAN Card</option>
                <option>Driving License</option>
                <option>Voter ID</option>
                <option>Passport</option>
                <option>Student ID</option>
                <option>Other</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">ID Number</label>
              <input type="text" name="visitor_id_number" class="form-input" placeholder="Optional">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Address</label>
            <input type="text" name="visitor_address" class="form-input" placeholder="Your city or address">
          </div>
          <div class="form-group">
            <label class="form-label form-required">Who Are You Visiting?</label>
            <select name="staff_id" class="form-select" required>
              <option value="">Select Staff / Professor</option>
              ${staffOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label form-required">Purpose of Visit</label>
            <textarea name="purpose" class="form-textarea" placeholder="e.g. Academic discussion, Project guidance, Document collection..." required></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label form-required">Scheduled Date</label>
              <input type="date" name="scheduled_date" class="form-input" required>
            </div>
            <div class="form-group">
              <label class="form-label">Preferred Time</label>
              <input type="time" name="scheduled_time" class="form-input">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Additional Notes</label>
            <textarea name="notes" class="form-textarea" placeholder="Any special requests or details..."></textarea>
          </div>
          <button type="submit" class="submit-btn" id="submitBtn">Submit Pre-Registration</button>
        </form>
      </div>
    </div>
    <div class="footer">IIEST E-Gate Pass System • Pre-Registration Portal</div>
  </div>

  <script>
    // ===== PHOTO HANDLING =====
    var capturedPhotoBlob = null;

    function processPhoto(file) {
      var errorDiv = document.getElementById('errorMsg');
      errorDiv.style.display = 'none';
      if (!file) return;

      if (file.size > 15 * 1024 * 1024) {
        errorDiv.textContent = 'Photo is too large (max 15MB). Please choose a smaller photo.';
        errorDiv.style.display = 'block';
        window.scrollTo(0,0);
        return;
      }

      // Store the raw file to be submitted
      capturedPhotoBlob = file;

      // Show preview
      var reader = new FileReader();
      reader.onload = function(ev) {
        var preview = document.getElementById('photoPreview');
        preview.innerHTML = '<img src="' + ev.target.result + '" alt="Your Photo">';
        preview.classList.add('has-photo');
      };
      reader.onerror = function() {
        errorDiv.textContent = 'Failed to load preview, but file is selected.';
        errorDiv.style.display = 'block';
        window.scrollTo(0,0);
      };
      reader.readAsDataURL(file);
    }

    document.getElementById('cameraInput').addEventListener('change', function(e) {
      if (e.target.files[0]) processPhoto(e.target.files[0]);
    });
    document.getElementById('galleryInput').addEventListener('change', function(e) {
      if (e.target.files[0]) processPhoto(e.target.files[0]);
    });

    // Set min date to today
    var dateInput = document.querySelector('input[name="scheduled_date"]');
    var now = new Date();
    var todayStr = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
    dateInput.setAttribute('min', todayStr);
    dateInput.value = todayStr;

    // ===== FORM SUBMIT =====
    document.getElementById('preRegForm').addEventListener('submit', function(e) {
      e.preventDefault();
      var btn = document.getElementById('submitBtn');
      var errorDiv = document.getElementById('errorMsg');
      errorDiv.style.display = 'none';

      var name = this.querySelector('[name="visitor_name"]').value.trim();
      var phone = this.querySelector('[name="visitor_phone"]').value.trim();
      var staffId = this.querySelector('[name="staff_id"]').value;
      var purpose = this.querySelector('[name="purpose"]').value.trim();

      if (!name) { errorDiv.textContent = 'Please enter your full name.'; errorDiv.style.display = 'block'; window.scrollTo(0,0); return; }
      if (!/^[0-9]{10}$/.test(phone)) { errorDiv.textContent = 'Please enter a valid 10-digit phone number.'; errorDiv.style.display = 'block'; window.scrollTo(0,0); return; }
      if (!staffId) { errorDiv.textContent = 'Please select who you are visiting.'; errorDiv.style.display = 'block'; window.scrollTo(0,0); return; }
      if (!purpose) { errorDiv.textContent = 'Please enter the purpose of your visit.'; errorDiv.style.display = 'block'; window.scrollTo(0,0); return; }

      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Submitting...';

      try {
        var formData = new FormData();
        formData.append('visitor_name', name);
        formData.append('visitor_phone', phone);
        formData.append('visitor_email', this.querySelector('[name="visitor_email"]').value.trim());
        formData.append('visitor_id_type', this.querySelector('[name="visitor_id_type"]').value);
        formData.append('visitor_id_number', this.querySelector('[name="visitor_id_number"]').value.trim());
        formData.append('visitor_address', this.querySelector('[name="visitor_address"]').value.trim());
        formData.append('staff_id', staffId);
        formData.append('purpose', purpose);
        formData.append('scheduled_date', this.querySelector('[name="scheduled_date"]').value);
        formData.append('scheduled_time', this.querySelector('[name="scheduled_time"]').value);
        formData.append('notes', this.querySelector('[name="notes"]').value.trim());

        if (capturedPhotoBlob) {
          formData.append('photo', capturedPhotoBlob, 'visitor_photo.jpg');
        }

        fetch('/api/pre-register', {
          method: 'POST',
          body: formData,
        })
        .then(function(response) {
          return response.json().catch(function() {
            throw new Error('Server error (status ' + response.status + ')');
          });
        })
        .then(function(data) {
          if (data.success) {
            window.location.href = '/pre-register/success/' + data.data.pre_registration.id;
          } else {
            errorDiv.textContent = data.message || 'Error submitting request. Please try again.';
            errorDiv.style.display = 'block';
            window.scrollTo(0,0);
            btn.disabled = false;
            btn.textContent = 'Submit Pre-Registration';
          }
        })
        .catch(function(err) {
          console.error('Submit error:', err);
          errorDiv.textContent = 'Submission failed: ' + (err.message || 'Please check your connection.');
          errorDiv.style.display = 'block';
          window.scrollTo(0,0);
          btn.disabled = false;
          btn.textContent = 'Submit Pre-Registration';
        });
      } catch (err) {
        console.error('Initial submit error:', err);
        errorDiv.textContent = 'An unexpected error occurred: ' + err.message;
        errorDiv.style.display = 'block';
        window.scrollTo(0,0);
        btn.disabled = false;
        btn.textContent = 'Submit Pre-Registration';
      }
    });
  </script>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Pre-register form page error:', error);
    res.status(500).send(renderErrorPage('Server Error', 'An unexpected error occurred.'));
  }
};


// GET /pre-register/success/:id — Confirmation page after submission
exports.renderSuccessPage = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT pr.*, v.full_name as visitor_name, s.full_name as staff_name, s.department
       FROM pre_registrations pr
       JOIN visitors v ON pr.visitor_id = v.id
       JOIN users s ON pr.staff_id = s.id
       WHERE pr.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send(renderErrorPage('Not Found', 'Pre-registration not found.'));
    }

    const pr = result.rows[0];
    const scheduledStr = new Date(pr.scheduled_date).toLocaleDateString('en-IN', { dateStyle: 'long' });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Registration Submitted — IIEST</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #e5e5e5; min-height: 100vh; display: flex; justify-content: center; padding: 20px; }
    .container { max-width: 420px; width: 100%; }
    .card { background: #171717; border: 1px solid #262626; border-radius: 16px; overflow: hidden; margin-bottom: 16px; }
    .header { text-align: center; padding: 28px 20px; background: linear-gradient(135deg, #171717 0%, #0a2010 100%); border-bottom: 1px solid #262626; }
    .success-icon { font-size: 52px; margin-bottom: 12px; }
    .success-title { font-size: 20px; font-weight: 900; color: #22c55e; }
    .success-subtitle { font-size: 13px; color: #a3a3a3; margin-top: 6px; line-height: 1.5; }
    .info-section { padding: 20px; }
    .info-row { display: flex; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid #1f1f1f; }
    .info-row:last-child { border-bottom: none; }
    .info-icon { font-size: 16px; margin-right: 10px; min-width: 22px; }
    .info-label { font-size: 10px; color: #737373; text-transform: uppercase; letter-spacing: 1px; }
    .info-value { font-size: 14px; color: #e5e5e5; font-weight: 600; margin-top: 2px; }
    .status-link {
      display: block; text-align: center; padding: 14px; margin: 0 20px 20px;
      background: linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%);
      color: #fff; font-size: 14px; font-weight: 800; border-radius: 12px; text-decoration: none;
      letter-spacing: 0.5px;
    }
    .status-link:hover { opacity: 0.9; }
    .note { text-align: center; padding: 0 20px 20px; font-size: 12px; color: #737373; line-height: 1.5; }
    .footer { text-align: center; padding: 16px; font-size: 10px; color: #525252; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div class="success-icon">✅</div>
        <div class="success-title">Request Submitted!</div>
        <div class="success-subtitle">Your pre-registration has been sent to the staff member for approval.</div>
      </div>
      <div class="info-section">
        <div class="info-row">
          <span class="info-icon">👤</span>
          <div><div class="info-label">Visitor</div><div class="info-value">${pr.visitor_name}</div></div>
        </div>
        <div class="info-row">
          <span class="info-icon">🎓</span>
          <div><div class="info-label">Visiting</div><div class="info-value">${pr.staff_name} — ${pr.department || ''}</div></div>
        </div>
        <div class="info-row">
          <span class="info-icon">📅</span>
          <div><div class="info-label">Scheduled Date</div><div class="info-value">${scheduledStr}${pr.scheduled_time ? ' at ' + pr.scheduled_time : ''}</div></div>
        </div>
        <div class="info-row">
          <span class="info-icon">🎯</span>
          <div><div class="info-label">Purpose</div><div class="info-value">${pr.purpose}</div></div>
        </div>
      </div>
      <a href="/pre-register/status/${pr.id}" class="status-link">🔍 Check Your Status & QR Code</a>
      <p class="note">Bookmark the link above! Once your request is approved, your <strong style="color:#a78bfa">QR code</strong> will appear there. Show it to the guard at the gate.</p>
    </div>
    <div class="footer">IIEST E-Gate Pass System</div>
  </div>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Success page error:', error);
    res.status(500).send(renderErrorPage('Server Error', 'An unexpected error occurred.'));
  }
};


// GET /pre-register/status/:id — Live status page (shows QR when approved)
exports.renderStatusPage = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT pr.*, v.full_name as visitor_name, v.phone as visitor_phone, v.photo_url as visitor_photo,
              s.full_name as staff_name, s.department as staff_department,
              gp.qr_data, gp.pass_code, gp.status as pass_status, gp.valid_until as pass_valid_until
       FROM pre_registrations pr
       JOIN visitors v ON pr.visitor_id = v.id
       JOIN users s ON pr.staff_id = s.id
       LEFT JOIN gate_passes gp ON pr.gate_pass_id = gp.id
       WHERE pr.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send(renderErrorPage('Not Found', 'Pre-registration not found.'));
    }

    const pr = result.rows[0];
    const scheduledStr = new Date(pr.scheduled_date).toLocaleDateString('en-IN', { dateStyle: 'long' });

    let statusLabel, statusColor, statusIcon;
    switch (pr.status) {
      case 'pending': statusLabel = 'PENDING APPROVAL'; statusColor = '#f59e0b'; statusIcon = '⏳'; break;
      case 'approved': statusLabel = 'APPROVED'; statusColor = '#22c55e'; statusIcon = '✅'; break;
      case 'rejected': statusLabel = 'REJECTED'; statusColor = '#ef4444'; statusIcon = '❌'; break;
      case 'expired': statusLabel = 'EXPIRED'; statusColor = '#6b7280'; statusIcon = '⏰'; break;
      case 'completed': statusLabel = 'COMPLETED'; statusColor = '#3b82f6'; statusIcon = '✔️'; break;
      default: statusLabel = pr.status.toUpperCase(); statusColor = '#737373'; statusIcon = '❓';
    }

    const SERVER_URL = process.env.SERVER_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;
    const photoAbsUrl = pr.visitor_photo ? `${SERVER_URL}${pr.visitor_photo}` : '';

    // QR section — shown only when approved
    let qrSection = '';
    if (pr.status === 'approved' && pr.qr_data) {
      const validUntilStr = new Date(pr.pass_valid_until || pr.valid_until).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
      qrSection = `
      <div class="qr-section">
        <div class="qr-title">🎉 Your Gate Pass is Ready!</div>
        <div class="qr-subtitle">Show this QR code to the guard at the campus gate</div>
        ${photoAbsUrl ? `<img src="${photoAbsUrl}" class="visitor-photo" alt="Your Photo" />` : ''}
        <img src="${pr.qr_data}" class="qr-img" alt="QR Code" />
        <div class="qr-code-text">${pr.pass_code || ''}</div>
        <div class="qr-valid">Valid until: ${validUntilStr}</div>
      </div>`;
    }

    // Rejection reason
    let rejectSection = '';
    if (pr.status === 'rejected' && pr.reject_reason) {
      rejectSection = `
      <div class="reject-box">
        <div class="reject-label">Reason for Rejection</div>
        <div class="reject-text">${pr.reject_reason}</div>
      </div>`;
    }

    // Pending message
    let pendingSection = '';
    if (pr.status === 'pending') {
      pendingSection = `
      <div class="pending-box">
        <div class="pending-icon">⏳</div>
        <div class="pending-text">Your request is being reviewed by <strong>${pr.staff_name}</strong>. Please check back later — this page will update when a decision is made.</div>
        <button class="refresh-btn" onclick="location.reload()">🔄 Refresh Status</button>
      </div>`;
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Visit Status — IIEST</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #e5e5e5; min-height: 100vh; display: flex; justify-content: center; padding: 20px; }
    .container { max-width: 420px; width: 100%; }
    .card { background: #171717; border: 1px solid #262626; border-radius: 16px; overflow: hidden; margin-bottom: 16px; }
    .header { text-align: center; padding: 24px 20px 16px; border-bottom: 1px solid #262626; }
    .logo { font-size: 18px; font-weight: 900; letter-spacing: 1px; color: #a78bfa; }
    .subtitle { font-size: 10px; color: #737373; margin-top: 3px; text-transform: uppercase; letter-spacing: 2px; }
    .status-badge { display: inline-block; padding: 8px 24px; border-radius: 24px; font-size: 14px; font-weight: 800; letter-spacing: 2px; margin-top: 14px; background: ${statusColor}20; color: ${statusColor}; border: 2px solid ${statusColor}40; }
    .qr-section { text-align: center; padding: 24px 20px; background: linear-gradient(180deg, #171717, #0f1f0f); }
    .qr-title { font-size: 18px; font-weight: 900; color: #22c55e; margin-bottom: 4px; }
    .qr-subtitle { font-size: 12px; color: #a3a3a3; margin-bottom: 20px; }
    .visitor-photo { width: 90px; height: 110px; border-radius: 10px; object-fit: cover; margin-bottom: 16px; border: 2px solid #333; }
    .qr-img { width: 220px; height: 220px; border-radius: 14px; background: #fff; padding: 10px; }
    .qr-code-text { font-size: 11px; color: #737373; margin-top: 10px; font-family: monospace; letter-spacing: 1px; }
    .qr-valid { font-size: 12px; color: #a78bfa; margin-top: 8px; font-weight: 700; }
    .info-section { padding: 0 20px 20px; }
    .info-row { display: flex; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid #1f1f1f; }
    .info-row:last-child { border-bottom: none; }
    .info-icon { font-size: 16px; margin-right: 10px; min-width: 22px; }
    .info-label { font-size: 10px; color: #737373; text-transform: uppercase; letter-spacing: 1px; }
    .info-value { font-size: 14px; color: #e5e5e5; font-weight: 600; margin-top: 2px; }
    .pending-box { text-align: center; padding: 30px 20px; }
    .pending-icon { font-size: 48px; margin-bottom: 12px; }
    .pending-text { font-size: 13px; color: #a3a3a3; line-height: 1.6; }
    .pending-text strong { color: #e5e5e5; }
    .refresh-btn { margin-top: 16px; padding: 10px 24px; background: #262626; color: #e5e5e5; border: 1px solid #404040; border-radius: 8px; font-size: 13px; cursor: pointer; font-family: inherit; font-weight: 600; }
    .refresh-btn:hover { background: #333; }
    .reject-box { margin: 0 20px 20px; padding: 14px; background: #ef444412; border: 1px solid #ef444430; border-radius: 10px; }
    .reject-label { font-size: 10px; color: #ef4444; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; margin-bottom: 4px; }
    .reject-text { font-size: 13px; color: #fca5a5; }
    .footer { text-align: center; padding: 16px; font-size: 10px; color: #525252; }
  </style>
  ${pr.status === 'pending' ? '<meta http-equiv="refresh" content="30">' : ''}
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div class="logo">IIEST E-GATE PASS</div>
        <div class="subtitle">Pre-Registration Status</div>
        <div class="status-badge">${statusIcon} ${statusLabel}</div>
      </div>

      ${qrSection}
      ${pendingSection}
      ${rejectSection}

      <div class="info-section">
        <div class="info-row">
          <span class="info-icon">👤</span>
          <div><div class="info-label">Visitor</div><div class="info-value">${pr.visitor_name}</div></div>
        </div>
        <div class="info-row">
          <span class="info-icon">📱</span>
          <div><div class="info-label">Phone</div><div class="info-value">${pr.visitor_phone}</div></div>
        </div>
        <div class="info-row">
          <span class="info-icon">🎓</span>
          <div><div class="info-label">Visiting</div><div class="info-value">${pr.staff_name} — ${pr.staff_department || ''}</div></div>
        </div>
        <div class="info-row">
          <span class="info-icon">🎯</span>
          <div><div class="info-label">Purpose</div><div class="info-value">${pr.purpose}</div></div>
        </div>
        <div class="info-row">
          <span class="info-icon">📅</span>
          <div><div class="info-label">Scheduled</div><div class="info-value">${scheduledStr}${pr.scheduled_time ? ' at ' + pr.scheduled_time : ''}</div></div>
        </div>
      </div>
    </div>
    <div class="footer">Show your QR code at the campus gate • IIEST E-Gate Pass System</div>
  </div>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Status page error:', error);
    res.status(500).send(renderErrorPage('Server Error', 'An unexpected error occurred.'));
  }
};


function renderErrorPage(title, message) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — IIEST</title>
<style>body{font-family:-apple-system,sans-serif;background:#0a0a0a;color:#e5e5e5;display:flex;justify-content:center;align-items:center;min-height:100vh;text-align:center;padding:20px}
.box{background:#171717;border:1px solid #262626;border-radius:16px;padding:40px;max-width:400px}
h1{font-size:22px;color:#ef4444;margin-bottom:8px}p{color:#737373;font-size:14px}
a{color:#a78bfa;text-decoration:none;display:inline-block;margin-top:16px;font-weight:600}</style>
</head><body><div class="box"><h1>${title}</h1><p>${message}</p><a href="/pre-register">← Back to Pre-Registration</a></div></body></html>`;
}
