const nodemailer = require('nodemailer');
require('dotenv').config();

const dns = require('dns');
// Force Node.js to prefer IPv4 — fixes "connect ENETUNREACH" when IPv6 is unavailable
dns.setDefaultResultOrder('ipv4first');

// Create reusable transporter using Gmail service
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
  tls: { rejectUnauthorized: false },
  connectionTimeout: 15000,
  greetingTimeout: 10000,
});

/**
 * Send OTP email to user
 * @param {string} toEmail - Recipient email
 * @param {string} otp - The OTP code
 * @param {string} type - 'login' or 'reset'
 * @param {string} userName - Optional user name for personalization
 */
async function sendOTPEmail(toEmail, otp, type = 'login', userName = '') {
  const isReset = type === 'reset';
  const subject = isReset
    ? '🔐 IIEST E-Gate — Password Reset OTP'
    : '🔑 IIEST E-Gate — Login Verification OTP';

  const heading = isReset ? 'Reset Your Password' : 'Login Verification';
  const message = isReset
    ? 'You have requested to reset your password. Use the OTP below to proceed:'
    : 'Use the OTP below to log in to your IIEST E-Gate account:';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0; padding:0; font-family: 'Segoe UI', Roboto, sans-serif; background-color: #0f172a;">
      <div style="max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 16px; padding: 16px 24px; margin-bottom: 16px;">
            <span style="font-size: 28px; font-weight: 900; color: #ffffff; letter-spacing: 1px;">IIEST E-Gate</span>
          </div>
          <p style="color: #94a3b8; font-size: 14px; margin: 0;">Campus Security Pass System</p>
        </div>

        <!-- Card -->
        <div style="background-color: #1e293b; border-radius: 16px; padding: 32px; border: 1px solid #334155;">
          ${userName ? `<p style="color: #e2e8f0; font-size: 16px; margin: 0 0 8px 0;">Hello, <strong>${userName}</strong></p>` : ''}
          <h2 style="color: #ffffff; font-size: 20px; font-weight: 800; margin: 0 0 12px 0;">${heading}</h2>
          <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">${message}</p>
          
          <!-- OTP Box -->
          <div style="text-align: center; margin: 24px 0;">
            <div style="display: inline-block; background: linear-gradient(135deg, #6366f115, #8b5cf615); border: 2px solid #6366f150; border-radius: 12px; padding: 20px 40px;">
              <span style="font-size: 36px; font-weight: 900; color: #a78bfa; letter-spacing: 12px; font-family: 'Courier New', monospace;">${otp}</span>
            </div>
          </div>
          
          <p style="color: #64748b; font-size: 12px; text-align: center; margin: 16px 0 0 0;">
            ⏰ This OTP is valid for <strong style="color: #f59e0b;">5 minutes</strong>. Do not share it with anyone.
          </p>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 24px;">
          <p style="color: #475569; font-size: 12px; margin: 0;">If you didn't request this, you can safely ignore this email.</p>
          <p style="color: #334155; font-size: 11px; margin-top: 16px;">© ${new Date().getFullYear()} IIEST Shibpur — Campus Security</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `"IIEST E-Gate Security" <${process.env.SMTP_EMAIL}>`,
    to: toEmail,
    subject,
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email] OTP sent to ${toEmail} — MessageID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[Email] Failed to send OTP to ${toEmail}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Verify SMTP connection is working
 */
async function verifyConnection() {
  try {
    await transporter.verify();
    console.log('✉️  SMTP email service connected');
    return true;
  } catch (error) {
    console.error('❌ SMTP connection failed:', error.message);
    return false;
  }
}

module.exports = { sendOTPEmail, verifyConnection };
