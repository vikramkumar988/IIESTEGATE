require('dotenv').config();
const { sendNotificationSMS } = require('./utils/smsService');

async function testSMS() {
  console.log('=== DETAILED SMS DIAGNOSTIC ===');
  console.log('SMS_ENABLED:', process.env.SMS_ENABLED);
  console.log('MSG91_AUTH_KEY set:', !!process.env.MSG91_AUTH_KEY);
  console.log('MSG91_FLOW_ID:', process.env.MSG91_FLOW_ID || 'NOT SET');
  
  // Replace with a valid test number or use a dummy
  const testPhone = '919876543210'; 
  console.log('Sending test SMS to:', testPhone);

  try {
    const result = await sendNotificationSMS(testPhone, 'This is a test SMS from IIEST E-Gate.');
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('Error:', e);
  }
}

testSMS().catch(e => console.error(e)).finally(() => process.exit());
