const router = require('express').Router();
const visitController = require('../controllers/visitController');
const authenticate = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const upload = require('../middleware/upload');

router.post('/', authenticate, roleCheck('guard'), upload.single('photo'), visitController.createVisitRequest);
router.get('/', authenticate, roleCheck('guard', 'admin'), visitController.getVisitRequests);
router.get('/pending', authenticate, roleCheck('staff'), visitController.getPendingRequests);
router.get('/history', authenticate, roleCheck('staff'), visitController.getStaffHistory);
router.get('/missed', authenticate, roleCheck('staff'), visitController.getMissedRequests);
router.get('/lookup-visitor', authenticate, roleCheck('guard', 'admin'), visitController.lookupVisitorByPhone);
router.get('/guard-history', authenticate, roleCheck('guard', 'admin'), visitController.getGuardDateHistory);
router.get('/search-visitor', authenticate, roleCheck('guard', 'admin'), visitController.searchVisitors);
router.get('/staff-active', authenticate, roleCheck('staff'), visitController.getStaffActiveVisitors);
router.get('/visitor-profile/:visitorId', authenticate, visitController.getVisitorProfile);
router.get('/daily-records', authenticate, visitController.getDailyRecords);
router.get('/:id', authenticate, visitController.getVisitRequest);
router.put('/:id/edit', authenticate, roleCheck('guard'), visitController.editVisitRequest);
router.put('/:id/re-raise', authenticate, roleCheck('guard'), visitController.reRaiseRequest);
router.put('/:id/approve', authenticate, roleCheck('staff'), visitController.approveRequest);
router.put('/:id/reject', authenticate, roleCheck('staff'), visitController.rejectRequest);
router.put('/:id/cancel', authenticate, roleCheck('guard', 'staff', 'admin'), visitController.cancelRequest);
router.put('/:id/confirm-meeting', authenticate, roleCheck('staff'), visitController.confirmMeeting);
router.post('/:id/refer', authenticate, roleCheck('staff'), visitController.referVisitor);

module.exports = router;
