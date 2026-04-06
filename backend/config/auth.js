require('dotenv').config();

module.exports = {
  jwtSecret: process.env.JWT_SECRET || 'iiest_egatepass_fallback_secret',
  jwtAccessExpiry: process.env.JWT_ACCESS_EXPIRY || '24h',
  jwtRefreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  saltRounds: 10,
  roles: {
    GUARD: 'guard',
    STAFF: 'staff',
    ADMIN: 'admin',
  },
};
