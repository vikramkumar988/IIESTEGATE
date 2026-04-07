require('dotenv').config();
const nodemailer = require('nodemailer');

async function pureTest() {
  console.log('--- Pure Test (No family option) ---');
  try {
    const t = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // TLS
      auth: { user: process.env.SMTP_EMAIL, pass: process.env.SMTP_PASSWORD },
    });
    console.log('Verifying...');
    await t.verify();
    console.log('SUCCESS');
    t.close();
  } catch (e) {
    console.log('FAILED:', e.message, '| code:', e.code);
  }
}

pureTest().catch(e => console.log('ERROR:', e)).finally(() => process.exit());
