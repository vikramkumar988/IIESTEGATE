const router = require('express').Router();
const gatePassController = require('../controllers/gatePassController');
const authenticate = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

router.post('/generate/:visitId', authenticate, roleCheck('guard'), gatePassController.generatePass);
router.post('/generate-general/:generalVisitId', authenticate, roleCheck('guard'), gatePassController.generateGeneralPass);
router.post('/verify', authenticate, roleCheck('guard'), gatePassController.verifyPass);
router.post('/exit', authenticate, roleCheck('guard'), gatePassController.logExit);
router.get('/', authenticate, roleCheck('guard', 'admin'), gatePassController.getPasses);
router.get('/:id', authenticate, gatePassController.getPass);
router.post('/:passId/send-sms', authenticate, roleCheck('guard', 'admin'), gatePassController.sendPassSMSManual);
router.put('/:id/revoke', authenticate, roleCheck('guard', 'admin'), gatePassController.revokePass);

module.exports = router;
