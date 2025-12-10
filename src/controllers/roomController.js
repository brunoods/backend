const roomService = require('../services/roomService');
const asyncHandler = require('../utils/asyncHandler');
const api = require('../services/api'); // Para reuso interno se necessário

exports.getRoom = asyncHandler(async (req, res) => {
    const items = await roomService.getRoomItems(req.params.childId);
    res.json(items);
});

exports.getInventory = asyncHandler(async (req, res) => {
    const items = await roomService.getInventory(req.params.childId);
    res.json(items);
});

exports.savePlacement = asyncHandler(async (req, res) => {
    const { inventoryId, x, y } = req.body;
    await roomService.placeItem(inventoryId, x, y);
    res.json({ success: true });
});

exports.removeFromRoom = asyncHandler(async (req, res) => {
    const { inventoryId } = req.body;
    await roomService.removeItem(inventoryId);
    res.json({ success: true });
});

exports.buyItem = asyncHandler(async (req, res) => {
    const { childId, itemKey, price } = req.body;
    await roomService.buyFurniture(childId, itemKey, price);
    res.json({ success: true });
});