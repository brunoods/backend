const loansService = require('../services/loansService');
const asyncHandler = require('../utils/asyncHandler');

exports.getLoans = asyncHandler(async (req, res) => {
    const loans = await loansService.listPending(req.params.childId);
    res.json(loans);
});

exports.createLoan = asyncHandler(async (req, res) => {
    const { childId, descricao, valor } = req.body;
    if (!descricao || !valor) {
        const error = new Error('Dados incompletos.');
        error.statusCode = 400;
        throw error;
    }
    await loansService.create({ childId, descricao, valor });
    res.status(201).json({ mensagem: 'Dívida registrada!' });
});

exports.payLoan = asyncHandler(async (req, res) => {
    await loansService.pay(req.params.id, req.body.valorPagamento);
    res.json({ mensagem: 'Pagamento realizado com sucesso!' });
});

exports.deleteLoan = asyncHandler(async (req, res) => {
    await loansService.delete(req.params.id);
    res.json({ mensagem: 'Dívida removida (perdoada).' });
});