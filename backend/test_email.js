require('dotenv').config();
const nodemailer = require('nodemailer');

async function test() {
  console.log('=== DETAILED EMAIL DIAGNOSTIC ===');
  console.log('SMTP_HOST:', process.env.SMTP_HOST);
  console.log('SMTP_PORT:', process.env.SMTP_PORT);
  console.log('SMTP_EMAIL:', process.env.SMTP_EMAIL);
  console.log('SMTP_PASSWORD:', process.env.SMTP_PASSWORD ? process.env.SMTP_PASSWORD.substring(0,4) + '****' : 'NOT SET');
  console.log('');

  // Test 1: Try with current config (dnsOptions)
  console.log('--- Test 1: Current config (dnsOptions family:4) ---');
  try {
    const t1 = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user: process.env.SMTP_EMAIL, pass: process.env.SMTP_PASSWORD },
      dnsOptions: { family: 4 },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 10000,
      greetingTimeout: 5000,
    });
    await t1.verify();
    console.log('   SUCCESS');
    t1.close();
  } catch (e) {
    console.log('   FAILED:', e.message, '| code:', e.code);
  }

  // Test 2: Try with direct family option
  console.log('--- Test 2: Direct family:4 option ---');
  try {
    const t2 = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user: process.env.SMTP_EMAIL, pass: process.env.SMTP_PASSWORD },
      family: 4,
      tls: { rejectUnauthorized: false },
      connectionTimeout: 10000,
      greetingTimeout: 5000,
    });
    await t2.verify();
    console.log('   SUCCESS');
    t2.close();
  } catch (e) {
    console.log('   FAILED:', e.message, '| code:', e.code);
  }

  // Test 3: Try port 465 SSL
  console.log('--- Test 3: Port 465 SSL ---');
  try {
    const t3 = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: process.env.SMTP_EMAIL, pass: process.env.SMTP_PASSWORD },
      family: 4,
      tls: { rejectUnauthorized: false },
      connectionTimeout: 10000,
      greetingTimeout: 5000,
    });
    await t3.verify();
    console.log('   SUCCESS');
    t3.close();
  } catch (e) {
    console.log('   FAILED:', e.message, '| code:', e.code);
  }

  // Test 4: Try with service: 'gmail'
  console.log('--- Test 4: Using service: gmail shorthand ---');
  try {
    const t4 = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.SMTP_EMAIL, pass: process.env.SMTP_PASSWORD },
      family: 4,
      connectionTimeout: 10000,
      greetingTimeout: 5000,
    });
    await t4.verify();
    console.log('   SUCCESS');
    t4.close();
  } catch (e) {
    console.log('   FAILED:', e.message, '| code:', e.code);
  }

  // Test 5: Raw DNS check
  console.log('--- Test 5: DNS resolution for smtp.gmail.com ---');
  const dns = require('dns');
  try {
    const addrs4 = await dns.promises.resolve4('smtp.gmail.com');
    console.log('   IPv4 addresses:', addrs4);
  } catch (e) {
    console.log('   IPv4 resolve failed:', e.message);
  }
  try {
    const addrs6 = await dns.promises.resolve6('smtp.gmail.com');
    console.log('   IPv6 addresses:', addrs6);
  } catch (e) {
    console.log('   IPv6 resolve failed:', e.message);
  }

  // Test 6: Raw TCP connection test
  console.log('--- Test 6: Raw TCP connection to smtp.gmail.com:587 ---');
  const net = require('net');
  await new Promise((resolve) => {
    const sock = net.createConnection({ host: 'smtp.gmail.com', port: 587, family: 4, timeout: 10000 });
    sock.on('connect', () => { console.log('   TCP CONNECTED'); sock.destroy(); resolve(); });
    sock.on('timeout', () => { console.log('   TCP TIMEOUT'); sock.destroy(); resolve(); });
    sock.on('error', (e) => { console.log('   TCP ERROR:', e.message, '| code:', e.code); resolve(); });
  });

  console.log('\n=== DONE ===');
}

test().catch(e => console.error('FATAL:', e)).finally(() => process.exit());
