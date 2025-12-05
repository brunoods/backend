const milestonesService = require('../services/milestonesService');
const asyncHandler = require('../utils/asyncHandler');

exports.getMilestones = asyncHandler(async (req, res) => {
    const milestones = await milestonesService.getByChild(req.params.childId);
    res.json(milestones);
});

exports.desbloquearConquista = asyncHandler(async (req, res) => {
    await milestonesService.unlockManually(req.body.childId, req.body.milestoneId);
    res.json({ mensagem: 'Conquista desbloqueada!' });
});

exports.toggleMilestone = asyncHandler(async (req, res) => {
    await milestonesService.toggle(req.body.childId, req.body.milestoneId);
    res.json({ mensagem: 'Conquista desbloqueada com sucesso!' });
});