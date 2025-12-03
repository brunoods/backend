const express = require('express');
const router = express.Router();
const tasksController = require('../controllers/tasksController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', tasksController.listarTarefas);
router.post('/', tasksController.criarTarefa);
router.put('/:id', tasksController.editarTarefa); // <--- NOVA ROTA
router.delete('/:id', tasksController.deletarTarefa);

module.exports = router;