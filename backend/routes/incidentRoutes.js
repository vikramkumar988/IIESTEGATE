const router = require('express').Router();
const incidentController = require('../controllers/incidentController');
const authenticate = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

router.post('/', authenticate, roleCheck('guard', 'staff', 'admin'), incidentController.createIncident);
router.get('/', authenticate, roleCheck('admin'), incidentController.getIncidents);
router.get('/:id', authenticate, incidentController.getIncidentById);
router.put('/:id/resolve', authenticate, roleCheck('admin'), incidentController.resolveIncident);

module.exports = router;
