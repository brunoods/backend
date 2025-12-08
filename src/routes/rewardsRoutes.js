const express = require('express');
const router = express.Router();
const rewardsController = require('../controllers/rewardsController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', rewardsController.listarRecompensas);
router.post('/', rewardsController.criarRecompensa);

// --- NOVA ROTA ---
router.put('/:id', rewardsController.editarRecompensa);

router.delete('/:id', rewardsController.deletarRecompensa);

module.exports = router;