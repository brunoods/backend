const express = require('express');
const router = express.Router();
const shopController = require('../controllers/shopController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', shopController.getCatalog);

module.exports = router;