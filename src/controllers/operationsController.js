const opService = require('../services/operationsService');
const asyncHandler = require('../utils/asyncHandler');

exports.realizarTarefa = asyncHandler(async (req, res) => {
    const pontos = await opService.completeTask(req.body.childId, req.body.taskId);
    res.status(200).json({ 
        mensagem: `Sucesso! +${pontos} pontos e XP para a criança.`,
        pontosGanhos: pontos 
    });
});

exports.ajusteManual = asyncHandler(async (req, res) => {
    await opService.manualAdjustment(req.body.childId, req.body.pontos, req.body.motivo);
    res.status(200).json({ mensagem: 'Saldo atualizado com sucesso.' });
});

exports.verExtrato = asyncHandler(async (req, res) => {
    const historico = await opService.getStatement(req.params.childId);
    res.json(historico);
});

exports.pagarMesada = asyncHandler(async (req, res) => {
    await opService.payAllowance(req.body.childId, req.body.valorEmReais);
    res.status(200).json({ mensagem: 'Pagamento registrado e saldo zerado! Nível mantido.' });
});