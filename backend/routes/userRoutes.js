const router = require('express').Router();
const userController = require('../controllers/userController');
const authenticate = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

router.get('/staff', authenticate, roleCheck('guard', 'admin'), userController.searchStaff);
router.get('/pending', authenticate, roleCheck('admin'), userController.getPendingUsers);
router.get('/blacklisted-visitors', authenticate, roleCheck('admin'), userController.getBlacklistedVisitors);
router.get('/still-inside', authenticate, roleCheck('guard', 'admin'), userController.getStillInside);
router.get('/', authenticate, roleCheck('admin'), userController.getUsers);
router.get('/:id', authenticate, roleCheck('admin'), userController.getUserById);
router.post('/', authenticate, roleCheck('admin'), userController.createUser);
router.post('/blacklist', authenticate, roleCheck('admin'), userController.blacklistVisitor);
router.post('/unblacklist', authenticate, roleCheck('admin'), userController.unblacklistVisitor);
router.post('/force-exit', authenticate, roleCheck('guard', 'admin'), userController.forceExit);
router.patch('/availability', authenticate, roleCheck('staff'), userController.updateAvailability);
router.put('/:id/approve', authenticate, roleCheck('admin'), userController.approveUser);
router.put('/:id/reject-registration', authenticate, roleCheck('admin'), userController.rejectUser);
router.put('/:id', authenticate, roleCheck('admin'), userController.updateUser);
router.delete('/:id', authenticate, roleCheck('admin'), userController.deleteUser);

module.exports = router;
