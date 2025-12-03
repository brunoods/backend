const express = require('express');
const router = express.Router();
const loansController = require('../controllers/loansController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/:childId', loansController.getLoans);
router.post('/', loansController.createLoan);
router.post('/pay/:id', loansController.payLoan);
router.delete('/:id', loansController.deleteLoan);

module.exports = router;