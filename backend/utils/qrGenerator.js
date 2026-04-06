const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

const generatePassCode = () => {
  const prefix = 'IIEST';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = uuidv4().split('-')[0].toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

const generateQRCode = async (data) => {
  try {
    const qrDataString = JSON.stringify(data);
    const qrCodeDataUrl = await QRCode.toDataURL(qrDataString, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
    return qrCodeDataUrl;
  } catch (error) {
    console.error('QR Generation Error:', error);
    throw new Error('Failed to generate QR code');
  }
};

const generateQRString = async (data) => {
  try {
    const qrDataString = JSON.stringify(data);
    return qrDataString;
  } catch (error) {
    throw new Error('Failed to generate QR data');
  }
};

module.exports = { generatePassCode, generateQRCode, generateQRString };
