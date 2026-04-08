const { Resend } = require('resend');
require('dotenv').config();

// Initialize Resend with API key (HTTP-based — works on Render free tier where SMTP is blocked)
const resend = new Resend(process.env.RESEND_API_KEY || 'missing_key');

// From address — Resend free tier allows sending from onboarding@resend.dev
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'IIEST E-Gate <onboarding@resend.dev>';

/**
 * Send email via Resend HTTP API
 */
async function sendEmail(to, subject, html) {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.error('[Email] RESEND_API_KEY not set in environment');
      return { success: false, error: 'Email API key not configured' };
    }

    const response = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html,
    });

    // Resend SDK can return { data, error } without throwing.
    if (response?.error) {
      const errMsg = response.error.message || response.error.name || 'Unknown Resend error';
      console.error(`[Email] Resend API error for ${to}:`, errMsg);
      return { success: false, error: errMsg };
    }

    const messageId = response?.data?.id;
    if (!messageId) {
      console.error(`[Email] No message id returned for ${to}. Raw response:`, JSON.stringify(response));
      return { success: false, error: 'Email provider did not return message ID' };
    }

    console.log(`[Email] Sent to ${to} — ID: ${messageId}`);
    return { success: true, messageId };
  } catch (error) {
    console.error(`[Email] Failed to send to ${to}:`, error.message);
    return { success: false, error: error.message };
  }
}

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

  return sendEmail(toEmail, subject, html);
}

/**
 * Send gate pass email to visitor with pass link
 */
async function sendGatePassEmail(toEmail, visitorName, passCode, passUrl, options = {}) {
  if (!toEmail || !toEmail.includes('@')) {
    console.log(`[Email] No valid email for visitor ${visitorName}, skipping`);
    return { success: false, error: 'No valid email address' };
  }

  const { staffName, purpose, validUntil } = options;
  const validStr = validUntil ? new Date(validUntil).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '';

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0; padding:0; font-family: 'Segoe UI', Roboto, sans-serif; background-color: #0f172a;">
      <div style="max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 16px; padding: 16px 24px; margin-bottom: 16px;">
            <span style="font-size: 28px; font-weight: 900; color: #ffffff; letter-spacing: 1px;">IIEST E-Gate</span>
          </div>
          <p style="color: #94a3b8; font-size: 14px; margin: 0;">Campus Gate Pass</p>
        </div>

        <div style="background-color: #1e293b; border-radius: 16px; padding: 32px; border: 1px solid #334155;">
          <p style="color: #e2e8f0; font-size: 16px; margin: 0 0 8px 0;">Hello, <strong>${visitorName}</strong></p>
          <h2 style="color: #22c55e; font-size: 20px; font-weight: 800; margin: 0 0 16px 0;">✅ Your Gate Pass is Ready!</h2>
          
          <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 8px 0;">
            Your campus visit to IIEST Shibpur has been approved.${staffName ? ' Approved by <strong style="color:#e2e8f0">' + staffName + '</strong>.' : ''}
          </p>
          ${purpose ? `<p style="color: #94a3b8; font-size: 13px; margin: 0 0 8px 0;">📋 Purpose: <strong style="color:#e2e8f0">${purpose}</strong></p>` : ''}
          ${validStr ? `<p style="color: #94a3b8; font-size: 13px; margin: 0 0 20px 0;">⏰ Valid until: <strong style="color:#f59e0b">${validStr}</strong></p>` : ''}
          
          <!-- Pass Code -->
          <div style="text-align: center; margin: 24px 0;">
            <div style="display: inline-block; background: linear-gradient(135deg, #22c55e15, #22c55e08); border: 2px solid #22c55e50; border-radius: 12px; padding: 16px 32px;">
              <p style="color: #94a3b8; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 4px 0;">Pass Code</p>
              <span style="font-size: 28px; font-weight: 900; color: #22c55e; letter-spacing: 8px; font-family: 'Courier New', monospace;">${passCode}</span>
            </div>
          </div>

          <!-- View Pass Button -->
          <div style="text-align: center; margin-top: 24px;">
            <a href="${passUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 12px; font-weight: 800; font-size: 15px; letter-spacing: 0.5px;">
              🎫 View Your Gate Pass & QR Code
            </a>
          </div>
          
          <p style="color: #64748b; font-size: 12px; text-align: center; margin: 20px 0 0 0;">
            Show the QR code at the campus gate for entry. Keep this email for your records.
          </p>
        </div>

        <div style="text-align: center; margin-top: 24px;">
          <p style="color: #475569; font-size: 12px; margin: 0;">Indian Institute of Engineering Science & Technology, Shibpur</p>
          <p style="color: #334155; font-size: 11px; margin-top: 8px;">© ${new Date().getFullYear()} IIEST E-Gate Pass System</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(toEmail, `🎫 Your IIEST Campus Gate Pass — ${passCode}`, html);
}

/**
 * Send pre-registration status email to visitor
 */
async function sendPreRegStatusEmail(toEmail, visitorName, status, options = {}) {
  if (!toEmail || !toEmail.includes('@')) {
    return { success: false, error: 'No valid email address' };
  }

  const { staffName, scheduledDate, passUrl, rejectReason } = options;
  const isApproved = status === 'approved';
  const subject = isApproved
    ? `✅ Visit Approved — IIEST Shibpur`
    : `❌ Visit Request Rejected — IIEST Shibpur`;
  
  const statusColor = isApproved ? '#22c55e' : '#ef4444';
  const statusIcon = isApproved ? '✅' : '❌';
  const statusText = isApproved ? 'APPROVED' : 'REJECTED';

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0; padding:0; font-family: 'Segoe UI', Roboto, sans-serif; background-color: #0f172a;">
      <div style="max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 16px; padding: 12px 20px;">
            <span style="font-size: 22px; font-weight: 900; color: #ffffff;">IIEST E-Gate</span>
          </div>
        </div>
        <div style="background-color: #1e293b; border-radius: 16px; padding: 32px; border: 1px solid #334155;">
          <p style="color: #e2e8f0; font-size: 16px; margin: 0 0 8px 0;">Hello, <strong>${visitorName}</strong></p>
          <div style="text-align: center; margin: 20px 0;">
            <span style="display: inline-block; padding: 8px 24px; border-radius: 24px; font-size: 14px; font-weight: 800; letter-spacing: 2px; background: ${statusColor}20; color: ${statusColor}; border: 2px solid ${statusColor}40;">
              ${statusIcon} ${statusText}
            </span>
          </div>
          <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 8px 0;">
            Your pre-registration visit request ${isApproved ? 'has been approved' : 'has been rejected'}${staffName ? ' by <strong style="color:#e2e8f0">' + staffName + '</strong>' : ''}.
          </p>
          ${scheduledDate ? `<p style="color: #94a3b8; font-size: 13px; margin: 0 0 8px 0;">📅 Scheduled: <strong style="color:#e2e8f0">${scheduledDate}</strong></p>` : ''}
          ${rejectReason ? `<p style="color: #fca5a5; font-size: 13px; margin: 16px 0 0 0; padding: 12px; background: #ef444412; border: 1px solid #ef444430; border-radius: 8px;">Reason: ${rejectReason}</p>` : ''}
          ${isApproved && passUrl ? `
          <div style="text-align: center; margin-top: 24px;">
            <a href="${passUrl}" style="display: inline-block; background: linear-gradient(135deg, #22c55e, #16a34a); color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 12px; font-weight: 800; font-size: 15px;">
              🎫 View Your Gate Pass
            </a>
          </div>
          <p style="color: #64748b; font-size: 12px; text-align: center; margin: 16px 0 0 0;">Show your QR code at the campus gate.</p>
          ` : ''}
        </div>
        <div style="text-align: center; margin-top: 24px;">
          <p style="color: #334155; font-size: 11px;">© ${new Date().getFullYear()} IIEST Shibpur — Campus Security</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(toEmail, subject, html);
}

/**
 * Verify email connection is working
 */
async function verifyConnection() {
  if (!process.env.RESEND_API_KEY) {
    console.log('⚠️ RESEND_API_KEY not set — email disabled');
    return false;
  }
  console.log('✉️  Resend email service configured (HTTP API — no SMTP needed)');
  return true;
}

module.exports = { sendOTPEmail, sendGatePassEmail, sendPreRegStatusEmail, verifyConnection };
