const router = require('express').Router();
const dashboardController = require('../controllers/dashboardController');
const authenticate = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

router.get('/stats', authenticate, roleCheck('admin'), dashboardController.getStats);
router.get('/visits-chart', authenticate, roleCheck('admin'), dashboardController.getVisitsChart);
router.get('/active-passes', authenticate, roleCheck('admin'), dashboardController.getActivePasses);
router.get('/guard-activity', authenticate, roleCheck('admin'), dashboardController.getGuardActivity);
router.get('/day-wise', authenticate, roleCheck('admin'), dashboardController.getDayWiseRecords);
router.get('/activity-logs', authenticate, roleCheck('admin'), dashboardController.getActivityLogs);
router.get('/lockdown-status', authenticate, dashboardController.getLockdownStatus);
router.post('/lockdown', authenticate, roleCheck('admin'), dashboardController.activateLockdown);
router.delete('/lockdown', authenticate, roleCheck('admin'), dashboardController.liftLockdown);

module.exports = router;
