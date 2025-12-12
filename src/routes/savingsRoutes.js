const express = require('express');
const router = express.Router();
const savingsController = require('../controllers/savingsController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/:childId', savingsController.getGoals);
router.post('/', savingsController.createGoal);
router.put('/:id', savingsController.updateGoal);
router.delete('/:id', savingsController.deleteGoal);
router.post('/move', savingsController.moveBalance);
router.post('/interest', savingsController.applyInterest);
router.post('/:id/transaction', savingsController.transaction);

module.exports = router;