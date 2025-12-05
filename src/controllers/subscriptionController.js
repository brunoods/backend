const subscriptionService = require('../services/subscriptionService');
const asyncHandler = require('../utils/asyncHandler');

exports.verifyPurchase = asyncHandler(async (req, res) => {
    await subscriptionService.verify(req.user.id, req.body);
    res.json({ success: true, message: 'Assinatura ativada!' });
});