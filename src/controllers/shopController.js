const shopService = require('../services/shopService');
const asyncHandler = require('../utils/asyncHandler');

exports.getCatalog = asyncHandler(async (req, res) => {
    const { category } = req.query; // Pode filtrar por ?category=avatar
    const items = await shopService.getCatalog(category);
    res.json(items);
});