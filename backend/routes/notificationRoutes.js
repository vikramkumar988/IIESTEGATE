const router = require('express').Router();
const notificationController = require('../controllers/notificationController');
const authenticate = require('../middleware/auth');

router.get('/', authenticate, notificationController.getNotifications);
router.put('/read-all', authenticate, notificationController.markAllAsRead);
router.get('/unread-count', authenticate, notificationController.getUnreadCount);
router.put('/:id/read', authenticate, notificationController.markAsRead);

module.exports = router;
