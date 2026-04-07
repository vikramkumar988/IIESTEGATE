require('dotenv').config();
const { verifyConnection, sendOTPEmail } = require('./utils/emailService');

async function testEmail() {
  console.log('=== RESEND EMAIL DIAGNOSTIC ===');
  console.log('RESEND_API_KEY set:', !!process.env.RESEND_API_KEY);
  console.log('RESEND_FROM_EMAIL:', process.env.RESEND_FROM_EMAIL || '(default onboarding@resend.dev)');
  console.log('EMAIL_TEST_TO:', process.env.EMAIL_TEST_TO || 'NOT SET');
  console.log('');

  console.log('--- Test 1: Service config check ---');
  const configured = await verifyConnection();
  console.log('Configured:', configured ? 'YES' : 'NO');

  if (!configured) {
    console.log('\nEmail is not configured. Set RESEND_API_KEY and run again.');
    return;
  }

  console.log('--- Test 2: Optional live send ---');
  if (!process.env.EMAIL_TEST_TO) {
    console.log('Skipped live send (set EMAIL_TEST_TO in .env to send a real test email).');
    return;
  }

  const result = await sendOTPEmail(
    process.env.EMAIL_TEST_TO,
    '123456',
    'login',
    'Test User'
  );

  console.log('Live send result:', JSON.stringify(result, null, 2));
}

testEmail()
  .catch((e) => console.error('FATAL:', e))
  .finally(() => process.exit());
