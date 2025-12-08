const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// Rota para estatísticas gerais (Dashboard)
router.get('/:childId', statsController.getChildStats);

// Rota para o Resumo Mensal (Story/Wrapped) - NOVA
router.get('/:childId/recap', statsController.getMonthlyRecap);

// Rota para o ranking da família
router.get('/family/ranking', statsController.getRankings);

module.exports = router;