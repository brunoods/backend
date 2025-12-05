const express = require('express');
const router = express.Router();
const petsController = require('../controllers/petsController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/:childId', petsController.listMyPets);
router.post('/buy', petsController.buyPet);
router.post('/equip', petsController.equipPet);

module.exports = router;