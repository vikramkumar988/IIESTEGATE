const router = require('express').Router();
const preRegController = require('../controllers/preRegController');
const authenticate = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const upload = require('../middleware/upload');

// ========== PUBLIC ENDPOINTS (no auth) ==========
router.get('/staff-list', preRegController.getStaffList);
router.post('/', upload.single('photo'), preRegController.createPreRegistration);
router.get('/status/:id', preRegController.getPreRegStatus);

// ========== STAFF ENDPOINTS ==========
router.get('/pending', authenticate, roleCheck('staff'), preRegController.getStaffPending);
router.get('/all', authenticate, roleCheck('staff', 'admin'), preRegController.getAllPreRegistrations);
router.put('/:id/approve', authenticate, roleCheck('staff'), preRegController.approvePreRegistration);
router.put('/:id/reject', authenticate, roleCheck('staff'), preRegController.rejectPreRegistration);

module.exports = router;
