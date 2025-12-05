const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// Listar filhos
exports.listarFilhos = asyncHandler(async (req, res) => {
    const parentId = req.user.id;
    const [filhos] = await db.execute(
        'SELECT * FROM children WHERE parent_id = ?',
        [parentId]
    );
    res.json(filhos);
});

// Criar filho (Transação)
exports.criarFilho = asyncHandler(async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const parentId = req.user.id;
        const { nome, avatar, dataNascimento, corFundo } = req.body;

        if (!nome) {
            throw new Error('O nome da criança é obrigatório.');
        }

        const [resultado] = await connection.execute(
            'INSERT INTO children (parent_id, nome, avatar, pontos, data_nascimento, cor_fundo) VALUES (?, ?, ?, 0, ?, ?)',
            [parentId, nome, avatar || 'default.png', dataNascimento || null, corFundo || '#F0F0F0']
        );

        const childId = resultado.insertId;
        let pontosIniciais = 0;

        if (dataNascimento) {
            const [milestone] = await connection.execute(
                "SELECT id, xp_reward FROM milestones WHERE titulo LIKE 'Cheguei ao Mundo%' LIMIT 1"
            );

            if (milestone.length > 0) {
                const { id: mId, xp_reward } = milestone[0];
                await connection.execute(
                    'INSERT INTO child_milestones (child_id, milestone_id, data_conquista) VALUES (?, ?, ?)',
                    [childId, mId, dataNascimento]
                );
                await connection.execute(
                    'UPDATE children SET xp = xp + ? WHERE id = ?',
                    [xp_reward, childId]
                );
                pontosIniciais = xp_reward; 
            }
        }

        await connection.commit();

        res.status(201).json({
            mensagem: 'Criança cadastrada com sucesso!',
            id: childId,
            nome,
            avatar: avatar || 'default.png',
            cor_fundo: corFundo || '#F0F0F0',
            pontos: 0,
            xp: pontosIniciais
        });

    } catch (error) {
        await connection.rollback();
        error.statusCode = 400; // Define erro como bad request se falhar validação
        throw error;
    } finally {
        connection.release();
    }
});

// Editar filho
exports.editarFilho = asyncHandler(async (req, res) => {
    const parentId = req.user.id;
    const { id } = req.params;
    const { nome, avatar, dataNascimento, corFundo } = req.body;

    if (!nome) {
        const error = new Error('Nome é obrigatório.');
        error.statusCode = 400;
        throw error;
    }

    const [result] = await db.execute(
        'UPDATE children SET nome = ?, avatar = ?, data_nascimento = ?, cor_fundo = ? WHERE id = ? AND parent_id = ?',
        [nome, avatar, dataNascimento || null, corFundo || '#F0F0F0', id, parentId]
    );

    if (result.affectedRows === 0) {
        const error = new Error('Criança não encontrada ou não autorizada.');
        error.statusCode = 404;
        throw error;
    }

    res.json({ mensagem: 'Dados atualizados com sucesso.' });
});

// Deletar filho
exports.deletarFilho = asyncHandler(async (req, res) => {
    const parentId = req.user.id;
    const { id } = req.params;

    const [resultado] = await db.execute(
        'DELETE FROM children WHERE id = ? AND parent_id = ?',
        [id, parentId]
    );

    if (resultado.affectedRows === 0) {
        const error = new Error('Criança não encontrada.');
        error.statusCode = 404;
        throw error;
    }

    res.json({ mensagem: 'Criança removida com sucesso.' });
});