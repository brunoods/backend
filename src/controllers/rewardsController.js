const rewardsService = require('../services/rewardsService');
const asyncHandler = require('../utils/asyncHandler');

exports.criarRecompensa = asyncHandler(async (req, res) => {
    const { nome, custo, icone } = req.body;
    if (!nome || !custo) {
        const error = new Error('Nome e custo são obrigatórios.');
        error.statusCode = 400;
        throw error;
    }
    const id = await rewardsService.create({ parentId: req.user.id, nome, custo, icone });
    res.status(201).json({ mensagem: 'Recompensa criada!', id });
});

exports.listarRecompensas = asyncHandler(async (req, res) => {
    const recompensas = await rewardsService.list(req.user.id);
    res.json(recompensas);
});

// --- NOVA FUNÇÃO DO CONTROLLER ---
exports.editarRecompensa = asyncHandler(async (req, res) => {
    const { nome, custo, icone } = req.body;
    
    if (!nome || !custo) {
        const error = new Error('Nome e custo são obrigatórios.');
        error.statusCode = 400;
        throw error;
    }

    await rewardsService.update(req.params.id, req.user.id, { 
        nome, 
        custo: parseInt(custo), 
        icone 
    });
    
    res.json({ mensagem: 'Recompensa atualizada com sucesso!' });
});

exports.deletarRecompensa = asyncHandler(async (req, res) => {
    await rewardsService.delete(req.params.id, req.user.id);
    res.json({ mensagem: 'Recompensa removida.' });
});