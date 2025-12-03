const db = require('../config/db');

// Criar recompensa
exports.criarRecompensa = async (req, res) => {
    try {
        const parentId = req.user.id;
        const { nome, custo, icone } = req.body;

        if (!nome || !custo) {
            return res.status(400).json({ mensagem: 'Nome e custo são obrigatórios.' });
        }

        const [resultado] = await db.execute(
            'INSERT INTO rewards (parent_id, nome, custo, icone) VALUES (?, ?, ?, ?)',
            [parentId, nome, custo, icone || '🎁']
        );

        res.status(201).json({ mensagem: 'Recompensa criada!', id: resultado.insertId });
    } catch (error) {
        res.status(500).json({ mensagem: 'Erro ao criar recompensa.' });
    }
};

// Listar recompensas do pai
exports.listarRecompensas = async (req, res) => {
    try {
        const parentId = req.user.id;
        const [recompensas] = await db.execute(
            'SELECT * FROM rewards WHERE parent_id = ? ORDER BY custo ASC',
            [parentId]
        );
        res.json(recompensas);
    } catch (error) {
        res.status(500).json({ mensagem: 'Erro ao buscar recompensas.' });
    }
};

// Deletar recompensa
exports.deletarRecompensa = async (req, res) => {
    try {
        const parentId = req.user.id;
        const { id } = req.params;
        await db.execute('DELETE FROM rewards WHERE id = ? AND parent_id = ?', [id, parentId]);
        res.json({ mensagem: 'Recompensa removida.' });
    } catch (error) {
        res.status(500).json({ mensagem: 'Erro ao remover.' });
    }
};