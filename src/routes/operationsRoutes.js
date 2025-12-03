const express = require('express');
const router = express.Router();
const operationsController = require('../controllers/operationsController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// Rota para marcar tarefa como feita
router.post('/concluir', operationsController.realizarTarefa);

// Rota para punição ou bônus manual
router.post('/ajuste', operationsController.ajusteManual);

// Rota para pagar mesada
router.post('/pagar', operationsController.pagarMesada);

// Rota para ver extrato
router.get('/extrato/:childId', operationsController.verExtrato);

module.exports = router;