// src/routes/petsRoutes.js
const express = require('express');
const router = express.Router();
const petsController = require('../controllers/petsController');
const authMiddleware = require('../middleware/authMiddleware');

// Protege todas as rotas abaixo (exige login)
router.use(authMiddleware);

// Rota para listar os pets da criança: GET /pets/1
router.get('/:childId', petsController.listMyPets);

// Rota para comprar: POST /pets/buy
router.post('/buy', petsController.buyPet);

// Rota para equipar: POST /pets/equip
router.post('/equip', petsController.equipPet);

module.exports = router;