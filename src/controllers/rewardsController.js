const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// Criar recompensa
exports.criarRecompensa = asyncHandler(async (req, res) => {
    const parentId = req.user.id;
    const { nome, custo, icone } = req.body;

    if (!nome || !custo) {
        const error = new Error('Nome e custo são obrigatórios.');
        error.statusCode = 400;
        throw error;
    }

    const [resultado] = await db.execute(
        'INSERT INTO rewards (parent_id, nome, custo, icone) VALUES (?, ?, ?, ?)',
        [parentId, nome, custo, icone || '🎁']
    );

    res.status(201).json({ mensagem: 'Recompensa criada!', id: resultado.insertId });
});

// Listar recompensas
exports.listarRecompensas = asyncHandler(async (req, res) => {
    const parentId = req.user.id;
    const [recompensas] = await db.execute(
        'SELECT * FROM rewards WHERE parent_id = ? ORDER BY custo ASC',
        [parentId]
    );
    res.json(recompensas);
});

// Deletar recompensa
exports.deletarRecompensa = asyncHandler(async (req, res) => {
    const parentId = req.user.id;
    const { id } = req.params;
    await db.execute('DELETE FROM rewards WHERE id = ? AND parent_id = ?', [id, parentId]);
    res.json({ mensagem: 'Recompensa removida.' });
});