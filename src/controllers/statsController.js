const statsService = require('../services/statsService');
const asyncHandler = require('../utils/asyncHandler');

exports.getChildStats = asyncHandler(async (req, res) => {
    const stats = await statsService.getChildStats(req.params.childId);
    res.json(stats);
});

exports.getRankings = asyncHandler(async (req, res) => {
    const rankings = await statsService.getRankings(req.user.id);
    res.json(rankings);
});