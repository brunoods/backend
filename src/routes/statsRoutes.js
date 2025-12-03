const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// Rota para estatísticas de um filho específico
router.get('/:childId', statsController.getChildStats);

// Rota para o ranking da família (Geral e Semanal)
router.get('/family/ranking', statsController.getRankings); // <--- NOVA

module.exports = router;