const savingsService = require('../services/savingsService');
const asyncHandler = require('../utils/asyncHandler');

exports.getGoals = asyncHandler(async (req, res) => {
    const goals = await savingsService.listByChild(req.params.childId);
    res.json(goals);
});

exports.createGoal = asyncHandler(async (req, res) => {
    const { childId, titulo, valorMeta, icone } = req.body;
    if (!titulo || !valorMeta) {
        const error = new Error('Dados incompletos.');
        error.statusCode = 400;
        throw error;
    }
    await savingsService.create({ childId, titulo, valorMeta, icone });
    res.status(201).json({ mensagem: 'Meta criada!' });
});

exports.updateGoal = asyncHandler(async (req, res) => {
    const { titulo, valorMeta } = req.body;
    if (!titulo || !valorMeta) {
        const error = new Error('Dados incompletos.');
        error.statusCode = 400;
        throw error;
    }
    await savingsService.update(req.params.id, { titulo, valorMeta });
    res.json({ mensagem: 'Meta atualizada!' });
});

exports.deleteGoal = asyncHandler(async (req, res) => {
    await savingsService.delete(req.params.id);
    res.json({ mensagem: 'Meta removida e saldo devolvido.' });
});

exports.moveBalance = asyncHandler(async (req, res) => {
    await savingsService.moveBalance(req.body);
    res.json({ mensagem: 'Movimentação realizada!' });
});

exports.applyInterest = asyncHandler(async (req, res) => {
    const rendimento = await savingsService.applyInterest(req.body.goalId, req.body.percentual);
    res.json({ mensagem: `Rendimento de ${rendimento} pontos aplicado!` });
});