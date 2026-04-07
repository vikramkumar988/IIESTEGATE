const router = require('express').Router();
const nodemailer = require('nodemailer');
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

router.get('/', async (req, res) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_EMAIL || 'iiestegate@gmail.com',
        pass: process.env.SMTP_PASSWORD,
      },
      tls: { rejectUnauthorized: false },
    });
    await transporter.verify();
    res.json({ success: true, message: 'SMTP connected successfully!' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, stack: error.stack, code: error.code });
  }
});
module.exports = router;
