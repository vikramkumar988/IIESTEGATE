const router = require('express').Router();
const authController = require('../controllers/authController');
const authenticate = require('../middleware/auth');
const { validateLogin, validateRegister, validatePublicRegister } = require('../utils/validators');
const upload = require('../middleware/upload');

router.post('/login', validateLogin, authController.login);
router.post('/register', authenticate, validateRegister, authController.register);
router.post('/register-public', upload.single('photo'), validatePublicRegister, authController.registerPublic);
router.get('/me', authenticate, authController.getMe);
router.post('/refresh', authController.refreshToken);
router.put('/push-token', authenticate, authController.updatePushToken);
router.put('/change-password', authenticate, authController.changePassword);

// OTP Login (no auth required)
router.post('/send-login-otp', authController.sendLoginOTP);
router.post('/verify-login-otp', authController.verifyLoginOTP);

// Forgot Password (no auth required)
router.post('/forgot-password', authController.sendForgotPasswordOTP);
router.post('/reset-password', authController.resetPassword);

module.exports = router;

