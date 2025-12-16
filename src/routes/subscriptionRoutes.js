const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const authMiddleware = require('../middleware/authMiddleware');

// Protege a rota para garantir que temos o req.user.id
router.use(authMiddleware);

router.post('/verify', subscriptionController.verifyPurchase);

module.exports = router;