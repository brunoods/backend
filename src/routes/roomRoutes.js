const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/:childId', roomController.getRoom);
router.get('/:childId/inventory', roomController.getInventory);
router.post('/place', roomController.savePlacement);
router.post('/remove', roomController.removeFromRoom);
router.post('/buy', roomController.buyItem);

module.exports = router;