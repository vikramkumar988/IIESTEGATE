const router = require('express').Router();
const journeyController = require('../controllers/journeyController');
const authenticate = require('../middleware/auth');

router.get('/visitor/:visitorId/active', authenticate, journeyController.getActiveJourney);
router.get('/visitor/:visitorId/history', authenticate, journeyController.getVisitorJourneys);
router.get('/visit-request/:visitRequestId', authenticate, journeyController.getJourneyByVisitRequest);
router.get('/:journeyId', authenticate, journeyController.getJourney);

module.exports = router;
