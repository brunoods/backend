const settingsService = require('../services/settingsService');
const asyncHandler = require('../utils/asyncHandler');

exports.getSettings = asyncHandler(async (req, res) => {
    const settings = await settingsService.get(req.user.id);
    res.json(settings);
});

exports.updateSettings = asyncHandler(async (req, res) => {
    await settingsService.update(req.user.id, req.body.valorPonto);
    res.json({ mensagem: 'Configuração atualizada com sucesso!' });
});