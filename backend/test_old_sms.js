const axios = require('axios');
const phone = '919876543210';
const message = 'Test SMS';
const authkey = '504323AHTH2oV3Rr69c946fcP1';

async function testOldApi() {
  const url = `https://control.msg91.com/api/sendhttp.php?authkey=${authkey}&mobiles=${phone}&message=${encodeURIComponent(message)}&sender=IIESTG&route=4`;
  try {
    const res = await axios.get(url);
    console.log('Old API Response:', res.data);
  } catch (e) {
    console.log('Old API Error:', e.response?.data || e.message);
  }
}

testOldApi();
