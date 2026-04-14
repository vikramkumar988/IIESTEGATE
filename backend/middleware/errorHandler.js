  const errorHandler = (err, req, res, next) => {
    console.error('❌ Error:', err.message);
    console.error(err.stack);

    if (err.name === 'MulterError') {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'File too large. Maximum size is 10MB.' });
      }
      return res.status(400).json({ success: false, message: err.message });
    }

    if (err.message && err.message.includes('Invalid file type')) {
      return res.status(400).json({ success: false, message: err.message });
    }

    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: 'A record with this information already exists.' });
    }

    if (err.code === '23503') {
      return res.status(400).json({ success: false, message: 'Referenced record not found.' });
    }

    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    });
  };

  module.exports = errorHandler;
