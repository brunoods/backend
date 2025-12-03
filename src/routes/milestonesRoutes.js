const express = require('express');
const router = express.Router();
const milestonesController = require('../controllers/milestonesController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/:childId', milestonesController.getMilestones);
router.post('/toggle', milestonesController.toggleMilestone);

module.exports = router;