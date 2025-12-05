const petsService = require('../services/petsService');
const asyncHandler = require('../utils/asyncHandler');

exports.listMyPets = asyncHandler(async (req, res) => {
    const pets = await petsService.listOwned(req.params.childId);
    res.json(pets);
});

exports.buyPet = asyncHandler(async (req, res) => {
    const petName = await petsService.buy(req.body.childId, req.body.petCode);
    res.json({ mensagem: `${petName} comprado com sucesso!` });
});

exports.equipPet = asyncHandler(async (req, res) => {
    await petsService.equip(req.body.childId, req.body.petCode);
    res.json({ mensagem: 'Pet equipado!' });
});