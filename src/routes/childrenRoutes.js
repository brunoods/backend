const express = require('express');
const router = express.Router();
const childrenController = require('../controllers/childrenController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', childrenController.listarFilhos);
router.post('/', childrenController.criarFilho);
router.put('/:id', childrenController.editarFilho); // <--- NOVA ROTA
router.delete('/:id', childrenController.deletarFilho);

module.exports = router;