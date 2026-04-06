const router = require('express').Router();
const generalVisitController = require('../controllers/generalVisitController');
const authenticate = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const upload = require('../middleware/upload');

router.post('/', authenticate, roleCheck('guard'), upload.single('photo'), generalVisitController.createGeneralVisit);
router.get('/', authenticate, roleCheck('guard', 'admin'), generalVisitController.getGeneralVisits);
router.get('/:id', authenticate, generalVisitController.getGeneralVisit);
router.put('/:id/revoke', authenticate, roleCheck('guard', 'admin'), generalVisitController.revokeGeneralVisit);

module.exports = router;
