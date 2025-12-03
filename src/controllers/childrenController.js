const db = require('../config/db');

// Listar todos os filhos do pai logado
exports.listarFilhos = async (req, res) => {
    try {
        const parentId = req.user.id;
        const [filhos] = await db.execute(
            'SELECT * FROM children WHERE parent_id = ?',
            [parentId]
        );
        res.json(filhos);
    } catch (error) {
        res.status(500).json({ mensagem: 'Erro ao buscar filhos.' });
    }
};

// Criar um novo filho (COM COR DE FUNDO)
exports.criarFilho = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const parentId = req.user.id;
        // Recebe corFundo agora
        const { nome, avatar, dataNascimento, corFundo } = req.body;

        if (!nome) {
            return res.status(400).json({ mensagem: 'O nome da criança é obrigatório.' });
        }

        // 1. Cria a criança
        const [resultado] = await connection.execute(
            'INSERT INTO children (parent_id, nome, avatar, pontos, data_nascimento, cor_fundo) VALUES (?, ?, ?, 0, ?, ?)',
            [parentId, nome, avatar || 'default.png', dataNascimento || null, corFundo || '#F0F0F0']
        );

        const childId = resultado.insertId;
        let pontosIniciais = 0;

        // 2. Conquista "Nasceu"
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
        console.error(error);
        res.status(500).json({ mensagem: 'Erro ao cadastrar filho.' });
    } finally {
        connection.release();
    }
};

// Editar filho (COM COR DE FUNDO)
exports.editarFilho = async (req, res) => {
    try {
        const parentId = req.user.id;
        const { id } = req.params;
        const { nome, avatar, dataNascimento, corFundo } = req.body;

        if (!nome) return res.status(400).json({ mensagem: 'Nome é obrigatório.' });

        const [result] = await db.execute(
            'UPDATE children SET nome = ?, avatar = ?, data_nascimento = ?, cor_fundo = ? WHERE id = ? AND parent_id = ?',
            [nome, avatar, dataNascimento || null, corFundo || '#F0F0F0', id, parentId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ mensagem: 'Criança não encontrada ou não autorizada.' });
        }

        res.json({ mensagem: 'Dados atualizados com sucesso.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensagem: 'Erro ao atualizar filho.' });
    }
};

// Deletar filho
exports.deletarFilho = async (req, res) => {
    try {
        const parentId = req.user.id;
        const { id } = req.params;

        const [resultado] = await db.execute(
            'DELETE FROM children WHERE id = ? AND parent_id = ?',
            [id, parentId]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ mensagem: 'Criança não encontrada.' });
        }

        res.json({ mensagem: 'Criança removida com sucesso.' });
    } catch (error) {
        res.status(500).json({ mensagem: 'Erro ao remover filho.' });
    }
};