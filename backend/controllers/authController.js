const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { jwtSecret, jwtAccessExpiry, jwtRefreshExpiry, saltRounds } = require('../config/auth');
const { logActivity } = require('../utils/activityLogger');

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, full_name: user.full_name },
    jwtSecret,
    { expiresIn: jwtAccessExpiry }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    jwtSecret,
    { expiresIn: jwtRefreshExpiry }
  );
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1 AND is_active = true', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Check if user is approved
    if (!user.is_approved) {
      return res.status(403).json({ success: false, message: 'Your account is pending admin approval. Please wait for an administrator to approve your registration.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        refreshToken,
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          organization: user.organization,
          department: user.department,
          designation: user.designation,
          gate_assigned: user.gate_assigned,
          employee_id: user.employee_id,
          profile_photo: user.profile_photo,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.register = async (req, res, next) => {
  try {
    const { full_name, email, phone, password, role, organization, department, designation, gate_assigned } = req.body;

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password, saltRounds);

    const profile_photo = req.file ? `/uploads/${req.file.filename}` : req.body.profile_photo;

    const result = await pool.query(
      `INSERT INTO users (full_name, email, phone, password_hash, role, organization, department, designation, gate_assigned, employee_id, profile_photo, is_approved)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true) RETURNING id, full_name, email, role`,
      [full_name, email, phone, password_hash, role, organization || 'iiest', department, designation, gate_assigned, req.body.employee_id, profile_photo]
    );

    await logActivity(req.user.id, 'create_user', 'user', result.rows[0].id, { role, email });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: { user: result.rows[0] },
    });
  } catch (error) {
    next(error);
  }
};

// Public registration (no auth required) — user needs admin approval
exports.registerPublic = async (req, res, next) => {
  try {
    const { full_name, email, phone, password, role, organization, department, designation, gate_assigned } = req.body;

    // Only guard and staff can self-register
    if (role === 'admin') {
      return res.status(403).json({ success: false, message: 'Admin accounts cannot be created through self-registration' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password, saltRounds);

    const profile_photo = req.file ? `/uploads/${req.file.filename}` : req.body.profile_photo;

    console.log(`[Registration] New request for ${full_name} (${role}) from ${organization || 'iiest'}`);

    const result = await pool.query(
      `INSERT INTO users (full_name, email, phone, password_hash, role, organization, department, designation, gate_assigned, employee_id, profile_photo, is_approved)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false) RETURNING id, full_name, email, role, organization`,
      [full_name, email, phone, password_hash, role, organization || 'iiest', department, designation, gate_assigned, req.body.employee_id, profile_photo]
    );

    console.log(`[Registration] User created with ID: ${result.rows[0].id}. Awaiting admin approval.`);

    await logActivity(null, 'public_registration', 'user', result.rows[0].id, { role, email, organization });

    // Notify all admins
    const admins = await pool.query("SELECT id FROM users WHERE role = 'admin' AND is_active = true AND is_approved = true");
    for (const admin of admins.rows) {
      await pool.query(
        `INSERT INTO notifications (user_id, title, body, type, reference_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [admin.id, 'New Registration Request 📝', `${full_name} (${role}) from ${organization || 'iiest'} has registered and is awaiting approval.`, 'registration', result.rows[0].id]
      );
    }

    res.status(201).json({
      success: true,
      message: 'Registration submitted successfully. Please wait for admin approval before you can login.',
      data: { user: result.rows[0] },
    });
  } catch (error) {
    next(error);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, full_name, email, phone, role, organization, department, designation, profile_photo, gate_assigned, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: { user: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};

exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, jwtSecret);
    const result = await pool.query('SELECT * FROM users WHERE id = $1 AND is_active = true', [decoded.id]);

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'User not found or deactivated' });
    }

    const user = result.rows[0];
    const newToken = generateToken(user);

    res.json({ success: true, data: { token: newToken } });
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
};

exports.updatePushToken = async (req, res, next) => {
  try {
    const { push_token } = req.body;
    await pool.query('UPDATE users SET push_token = $1, updated_at = NOW() WHERE id = $2', [push_token, req.user.id]);
    res.json({ success: true, message: 'Push token updated' });
  } catch (error) {
    next(error);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(current_password, result.rows[0].password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    const password_hash = await bcrypt.hash(new_password, saltRounds);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [password_hash, req.user.id]);

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
};

// ============== OTP LOGIN ==============

const { sendOTPEmail } = require('../utils/emailService');

// Generate a 4-digit OTP
function generateOTP() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Send login OTP
exports.sendLoginOTP = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Check if user exists and is active
    const userResult = await pool.query(
      'SELECT id, full_name, email, is_active, is_approved FROM users WHERE email = $1',
      [email.trim().toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No account found with this email' });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Your account has been deactivated' });
    }

    if (!user.is_approved) {
      return res.status(403).json({ success: false, message: 'Your account is pending admin approval' });
    }

    // Rate limit: max 1 OTP per 60 seconds
    const recentOTP = await pool.query(
      `SELECT id FROM otp_verifications WHERE email = $1 AND type = 'login' AND used = false AND created_at > NOW() - INTERVAL '60 seconds'`,
      [email.trim().toLowerCase()]
    );

    if (recentOTP.rows.length > 0) {
      return res.status(429).json({ success: false, message: 'Please wait 60 seconds before requesting a new OTP' });
    }

    // Invalidate previous unused OTPs
    await pool.query(
      `UPDATE otp_verifications SET used = true WHERE email = $1 AND type = 'login' AND used = false`,
      [email.trim().toLowerCase()]
    );

    // Generate OTP and hash it
    const otp = generateOTP();
    const otpHash = await bcrypt.hash(otp, saltRounds);

    // Store in DB with 5-minute expiry
    await pool.query(
      `INSERT INTO otp_verifications (email, otp_hash, type, expires_at) VALUES ($1, $2, 'login', NOW() + INTERVAL '5 minutes')`,
      [email.trim().toLowerCase(), otpHash]
    );

    // Send email
    const emailResult = await sendOTPEmail(email.trim().toLowerCase(), otp, 'login', user.full_name);

    if (!emailResult.success) {
      return res.status(500).json({ success: false, message: 'Failed to send OTP email. Please try password login.' });
    }

    console.log(`[OTP] Login OTP sent to ${email}`);

    res.json({
      success: true,
      message: 'OTP sent to your email. Please check your inbox.',
      data: { email: email.trim().toLowerCase() },
    });
  } catch (error) {
    next(error);
  }
};

// Verify login OTP and return JWT
exports.verifyLoginOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

    // Find the latest unused OTP for this email
    const otpResult = await pool.query(
      `SELECT id, otp_hash, expires_at, attempts FROM otp_verifications
       WHERE email = $1 AND type = 'login' AND used = false
       ORDER BY created_at DESC LIMIT 1`,
      [email.trim().toLowerCase()]
    );

    if (otpResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No OTP found. Please request a new one.' });
    }

    const otpRecord = otpResult.rows[0];

    // Check expiry
    if (new Date(otpRecord.expires_at) < new Date()) {
      await pool.query('UPDATE otp_verifications SET used = true WHERE id = $1', [otpRecord.id]);
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    // Check max attempts (5)
    if (otpRecord.attempts >= 5) {
      await pool.query('UPDATE otp_verifications SET used = true WHERE id = $1', [otpRecord.id]);
      return res.status(400).json({ success: false, message: 'Too many failed attempts. Please request a new OTP.' });
    }

    // Verify OTP
    const isMatch = await bcrypt.compare(otp, otpRecord.otp_hash);

    if (!isMatch) {
      await pool.query('UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = $1', [otpRecord.id]);
      const remaining = 4 - otpRecord.attempts;
      return res.status(400).json({ success: false, message: `Invalid OTP. ${remaining > 0 ? remaining + ' attempts remaining.' : 'Please request a new OTP.'}` });
    }

    // Mark OTP as used
    await pool.query('UPDATE otp_verifications SET used = true WHERE id = $1', [otpRecord.id]);

    // Get user and generate tokens
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1 AND is_active = true', [email.trim().toLowerCase()]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = userResult.rows[0];
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    console.log(`[OTP] Login OTP verified for ${email}`);

    res.json({
      success: true,
      message: 'OTP verified. Login successful!',
      data: {
        token,
        refreshToken,
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          organization: user.organization,
          department: user.department,
          designation: user.designation,
          gate_assigned: user.gate_assigned,
          employee_id: user.employee_id,
          profile_photo: user.profile_photo,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============== FORGOT PASSWORD ==============

// Send forgot password OTP
exports.sendForgotPasswordOTP = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Check if user exists
    const userResult = await pool.query(
      'SELECT id, full_name, email FROM users WHERE email = $1 AND is_active = true',
      [email.trim().toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      // Don't reveal if email exists or not for security
      return res.json({ success: true, message: 'If this email is registered, you will receive an OTP.' });
    }

    const user = userResult.rows[0];

    // Rate limit: max 1 OTP per 60 seconds
    const recentOTP = await pool.query(
      `SELECT id FROM otp_verifications WHERE email = $1 AND type = 'reset' AND used = false AND created_at > NOW() - INTERVAL '60 seconds'`,
      [email.trim().toLowerCase()]
    );

    if (recentOTP.rows.length > 0) {
      return res.status(429).json({ success: false, message: 'Please wait 60 seconds before requesting a new OTP' });
    }

    // Invalidate previous unused reset OTPs
    await pool.query(
      `UPDATE otp_verifications SET used = true WHERE email = $1 AND type = 'reset' AND used = false`,
      [email.trim().toLowerCase()]
    );

    // Generate and store OTP
    const otp = generateOTP();
    const otpHash = await bcrypt.hash(otp, saltRounds);

    await pool.query(
      `INSERT INTO otp_verifications (email, otp_hash, type, expires_at) VALUES ($1, $2, 'reset', NOW() + INTERVAL '5 minutes')`,
      [email.trim().toLowerCase(), otpHash]
    );

    // Send email
    const emailResult = await sendOTPEmail(email.trim().toLowerCase(), otp, 'reset', user.full_name);

    if (!emailResult.success) {
      return res.status(500).json({ success: false, message: 'Failed to send OTP email. Please try again later.' });
    }

    console.log(`[OTP] Password reset OTP sent to ${email}`);

    res.json({
      success: true,
      message: 'Password reset OTP sent to your email.',
      data: { email: email.trim().toLowerCase() },
    });
  } catch (error) {
    next(error);
  }
};

// Reset password with OTP verification
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, otp, new_password } = req.body;
    if (!email || !otp || !new_password) {
      return res.status(400).json({ success: false, message: 'Email, OTP, and new password are required' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    // Find the latest unused reset OTP
    const otpResult = await pool.query(
      `SELECT id, otp_hash, expires_at, attempts FROM otp_verifications
       WHERE email = $1 AND type = 'reset' AND used = false
       ORDER BY created_at DESC LIMIT 1`,
      [email.trim().toLowerCase()]
    );

    if (otpResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No OTP found. Please request a new one.' });
    }

    const otpRecord = otpResult.rows[0];

    // Check expiry
    if (new Date(otpRecord.expires_at) < new Date()) {
      await pool.query('UPDATE otp_verifications SET used = true WHERE id = $1', [otpRecord.id]);
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    // Check max attempts
    if (otpRecord.attempts >= 5) {
      await pool.query('UPDATE otp_verifications SET used = true WHERE id = $1', [otpRecord.id]);
      return res.status(400).json({ success: false, message: 'Too many failed attempts. Please request a new OTP.' });
    }

    // Verify OTP
    const isMatch = await bcrypt.compare(otp, otpRecord.otp_hash);

    if (!isMatch) {
      await pool.query('UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = $1', [otpRecord.id]);
      const remaining = 4 - otpRecord.attempts;
      return res.status(400).json({ success: false, message: `Invalid OTP. ${remaining > 0 ? remaining + ' attempts remaining.' : 'Please request a new OTP.'}` });
    }

    // Mark OTP as used
    await pool.query('UPDATE otp_verifications SET used = true WHERE id = $1', [otpRecord.id]);

    // Update password
    const password_hash = await bcrypt.hash(new_password, saltRounds);
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2',
      [password_hash, email.trim().toLowerCase()]
    );

    console.log(`[OTP] Password reset successful for ${email}`);

    await logActivity(null, 'password_reset', 'user', null, { email: email.trim().toLowerCase() });

    res.json({ success: true, message: 'Password reset successfully! You can now login with your new password.' });
  } catch (error) {
    next(error);
  }
};

