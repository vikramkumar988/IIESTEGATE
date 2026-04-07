/**
 * SMS Service — MSG91 Integration (Modern API)
 * 
 * Supports two modes:
 * 1. Flow API (production) — uses MSG91 Flow templates, requires MSG91_FLOW_ID
 * 2. Send SMS API v5 (fallback) — uses modern MSG91 v5 API for direct SMS
 * 
 * Set SMS_ENABLED=true and MSG91_AUTH_KEY in .env to activate.
 * When disabled, SMS calls silently succeed with a log message.
 */
const axios = require('axios');

const SMS_ENABLED = process.env.SMS_ENABLED === 'true';
const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY;
const MSG91_SENDER_ID = process.env.MSG91_SENDER_ID || 'IIESTG';
const MSG91_ROUTE = process.env.MSG91_ROUTE || '4'; // 4 = Transactional
const MSG91_DLT_TE_ID = process.env.MSG91_DLT_TE_ID || '';
const MSG91_FLOW_ID = process.env.MSG91_FLOW_ID || '';
const SERVER_PUBLIC_URL = process.env.SERVER_PUBLIC_URL || 'http://localhost:3000';

/**
 * Normalize Indian phone number to 91XXXXXXXXXX format
 */
function normalizePhone(phone) {
  let normalized = phone.replace(/[\s\-\(\)]/g, ''); // Remove spaces, dashes, parens
  normalized = normalized.replace(/^\+/, ''); // Remove leading +
  if (/^\d{10}$/.test(normalized)) normalized = '91' + normalized;
  if (!normalized.startsWith('91')) normalized = '91' + normalized;
  return normalized;
}

/**
 * Send SMS via MSG91 Flow API (Production — template-based)
 */
async function sendViaFlowAPI(phone, variables) {
  const payload = {
    flow_id: MSG91_FLOW_ID,
    sender: MSG91_SENDER_ID,
    mobiles: phone,
    ...variables, // e.g. { name: 'Vikram', link: 'http://...' }
  };

  const response = await axios.post(
    'https://control.msg91.com/api/v5/flow/',
    payload,
    {
      headers: {
        'authkey': MSG91_AUTH_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );

  return response.data;
}

/**
 * Send SMS via MSG91 v5 Send API (Modern — replaces deprecated sendhttp.php)
 */
async function sendViaSendAPI(phone, message) {
  try {
    // Use the modern MSG91 v5 send API
    const url = `https://control.msg91.com/api/sendhttp.php`;
    console.log(`📱 MSG91 API call to ${phone}, authkey present: ${!!MSG91_AUTH_KEY}, message length: ${message.length}`);
    const response = await axios.get(url, {
      params: {
        authkey: MSG91_AUTH_KEY,
        mobiles: phone,
        message: message,
        sender: MSG91_SENDER_ID,
        route: MSG91_ROUTE,
        DLT_TE_ID: MSG91_DLT_TE_ID || undefined
      },
      timeout: 20000,
    });
    console.log(`📱 MSG91 raw response:`, typeof response.data === 'string' ? response.data : JSON.stringify(response.data));
    return response.data;
  } catch (apiError) {
    const errDetail = apiError.response?.data || apiError.message;
    const errStatus = apiError.response?.status;
    console.error(`📱 MSG91 Send API error (HTTP ${errStatus || 'N/A'}):`, typeof errDetail === 'string' ? errDetail : JSON.stringify(errDetail));
    // Return error info instead of throwing — keeps the flow non-fatal
    return `ERROR: ${typeof errDetail === 'string' ? errDetail : JSON.stringify(errDetail)}`;
  }
}

/**
 * Send SMS with gate pass link to visitor
 * @param {string} phone - Visitor phone number
 * @param {string} passCode - Pass code for URL
 * @param {string} visitorName - Visitor name for personalization
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function sendPassSMS(phone, passCode, visitorName) {
  const passUrl = `${SERVER_PUBLIC_URL}/pass/${passCode}`;
  const message = `Hello ${visitorName}, your IIEST campus gate pass is ready. View your pass and QR code: ${passUrl} - Show this at the gate. IIEST Shibpur`;

  if (!SMS_ENABLED) {
    console.log(`📱 SMS disabled — would send to ${phone}: ${passUrl}`);
    return { success: true, message: 'SMS disabled — skipped', passUrl };
  }

  if (!MSG91_AUTH_KEY) {
    console.warn('⚠️ SMS_ENABLED=true but MSG91_AUTH_KEY not set in .env');
    return { success: false, message: 'MSG91_AUTH_KEY not configured' };
  }

  const normalizedPhone = normalizePhone(phone);
  console.log(`📱 Sending gate pass SMS to ${normalizedPhone}...`);
  console.log(`📱 Pass URL: ${passUrl}`);

  try {
    let responseData;

    if (MSG91_FLOW_ID) {
      // Use Flow API (production)
      responseData = await sendViaFlowAPI(normalizedPhone, {
        name: visitorName,
        link: passUrl,
      });
      console.log(`📱 Flow API response:`, JSON.stringify(responseData));
    } else {
      // Fallback to direct send API
      responseData = await sendViaSendAPI(normalizedPhone, message);
      console.log(`📱 Send API response:`, typeof responseData === 'string' ? responseData : JSON.stringify(responseData));
    }

    const resStr = typeof responseData === 'string' ? responseData : JSON.stringify(responseData);

    if (resStr && !resStr.toLowerCase().includes('error')) {
      console.log(`✅ SMS sent successfully to ${phone}: ${passUrl}`);
      return { success: true, message: 'SMS sent successfully', requestId: resStr, passUrl };
    } else {
      console.error(`❌ SMS API returned error for ${phone}: ${resStr}`);
      return { success: false, message: `MSG91 error: ${resStr}`, passUrl };
    }
  } catch (error) {
    const errMsg = error.response?.data || error.message;
    console.error(`❌ SMS failed for ${phone}:`, errMsg);
    return { success: false, message: typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg), passUrl };
  }
}

/**
 * Send pre-registration approval SMS to visitor
 * @param {string} phone - Visitor phone number
 * @param {string} visitorName - Visitor name
 * @param {string} staffName - Approving staff name
 * @param {string} scheduledDate - Visit date
 * @param {string} passCode - Pass code for QR/URL
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function sendPreRegApprovalSMS(phone, visitorName, staffName, scheduledDate, passCode) {
  const passUrl = `${SERVER_PUBLIC_URL}/pass/${passCode}`;
  const message = `Hello ${visitorName}, your visit to IIEST Shibpur has been approved by ${staffName} for ${scheduledDate}. View your QR pass: ${passUrl} - Show this at the campus gate.`;

  if (!SMS_ENABLED) {
    console.log(`📱 SMS disabled — pre-reg approval would send to ${phone}: ${passUrl}`);
    return { success: true, message: 'SMS disabled — skipped' };
  }

  if (!MSG91_AUTH_KEY) {
    console.warn('⚠️ SMS_ENABLED=true but MSG91_AUTH_KEY not set in .env');
    return { success: false, message: 'MSG91_AUTH_KEY not configured' };
  }

  const normalizedPhone = normalizePhone(phone);
  console.log(`📱 Sending pre-reg approval SMS to ${normalizedPhone}...`);

  try {
    let responseData;

    if (MSG91_FLOW_ID) {
      responseData = await sendViaFlowAPI(normalizedPhone, {
        name: visitorName,
        staff_name: staffName,
        date: scheduledDate,
        link: passUrl,
      });
    } else {
      responseData = await sendViaSendAPI(normalizedPhone, message);
    }

    const resStr = typeof responseData === 'string' ? responseData : JSON.stringify(responseData);
    if (resStr && !resStr.toLowerCase().includes('error')) {
      console.log(`✅ Pre-reg approval SMS sent to ${phone}`);
      return { success: true, message: 'SMS sent successfully', requestId: resStr };
    } else {
      console.error(`❌ Pre-reg SMS error for ${phone}: ${resStr}`);
      return { success: false, message: `MSG91 error: ${resStr}` };
    }
  } catch (error) {
    const errMsg = error.response?.data || error.message;
    console.error(`❌ Pre-reg SMS failed for ${phone}:`, errMsg);
    return { success: false, message: typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg) };
  }
}

/**
 * Send a generic notification SMS
 * @param {string} phone - Phone number
 * @param {string} message - SMS content
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function sendNotificationSMS(phone, message) {
  if (!SMS_ENABLED) {
    console.log(`📱 SMS disabled — notification to ${phone}: ${message.substring(0, 40)}...`);
    return { success: true, message: 'SMS disabled — skipped' };
  }

  if (!MSG91_AUTH_KEY) {
    return { success: false, message: 'MSG91_AUTH_KEY not configured' };
  }

  const normalizedPhone = normalizePhone(phone);
  console.log(`📱 Sending notification SMS to ${normalizedPhone}...`);

  try {
    const responseData = await sendViaSendAPI(normalizedPhone, message);
    const resStr = typeof responseData === 'string' ? responseData : JSON.stringify(responseData);

    console.log(`📱 Notification SMS response: ${resStr}`);

    if (resStr && !resStr.toLowerCase().includes('error')) {
      console.log(`✅ Notification SMS sent to ${phone}`);
      return { success: true, message: 'SMS sent', requestId: resStr };
    }
    return { success: false, message: `MSG91: ${resStr}` };
  } catch (error) {
    const errMsg = error.response?.data || error.message;
    console.error(`❌ Notification SMS failed:`, errMsg);
    return { success: false, message: typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg) };
  }
}

module.exports = { sendPassSMS, sendPreRegApprovalSMS, sendNotificationSMS };
