const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

// Rotas Públicas
router.post('/register', authController.registrarPai);
router.post('/login', authController.login);

// Rotas Protegidas (Vínculo Familiar)
router.post('/link-request', authMiddleware, authController.solicitarVinculo);
router.get('/link-requests', authMiddleware, authController.listarSolicitacoes);
router.post('/link-response', authMiddleware, authController.responderVinculo);

// Rotas de Perfil
router.put('/profile', authMiddleware, authController.editarPerfil);
router.put('/password', authMiddleware, authController.alterarSenha);

module.exports = router;