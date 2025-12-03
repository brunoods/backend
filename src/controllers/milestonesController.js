const db = require('../config/db');

exports.getMilestones = async (req, res) => {
    try {
        const { childId } = req.params;

        // ADICIONEI "m.faixa_etaria" NA SELECT
        const [rows] = await db.execute(`
            SELECT 
                m.id, 
                m.titulo, 
                m.descricao, 
                m.icone, 
                m.xp_reward,
                m.faixa_etaria, 
                cm.data_conquista
            FROM milestones m
            LEFT JOIN child_milestones cm ON m.id = cm.milestone_id AND cm.child_id = ?
            ORDER BY m.id ASC
        `, [childId]);

        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensagem: 'Erro ao buscar conquistas.' });
    }
};

// Opcional: Rota para desbloquear uma conquista manualmente (caso esqueceu de marcar)
exports.desbloquearConquista = async (req, res) => {
    try {
        const { childId, milestoneId } = req.body;
        
        // Verifica se já tem
        const [check] = await db.execute(
            'SELECT id FROM child_milestones WHERE child_id = ? AND milestone_id = ?', 
            [childId, milestoneId]
        );

        if (check.length > 0) {
            return res.status(400).json({ mensagem: 'Conquista já desbloqueada.' });
        }

        // Adiciona e dá XP (opcional somar XP aqui, depende da regra)
        await db.execute(
            'INSERT INTO child_milestones (child_id, milestone_id) VALUES (?, ?)',
            [childId, milestoneId]
        );

        res.json({ mensagem: 'Conquista desbloqueada!' });
    } catch (error) {
        res.status(500).json({ mensagem: 'Erro ao desbloquear.' });
    }
};

// Função para marcar conquista manualmente e DAR XP
exports.toggleMilestone = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { childId, milestoneId } = req.body;

        // 1. Verifica se já tem
        const [existing] = await connection.execute(
            'SELECT * FROM child_milestones WHERE child_id = ? AND milestone_id = ?',
            [childId, milestoneId]
        );

        if (existing.length > 0) {
            await connection.rollback();
            return res.status(400).json({ mensagem: 'Esta conquista já foi registrada!' });
        }

        // 2. Busca quanto XP vale essa conquista
        const [milestoneInfo] = await connection.execute(
            'SELECT xp_reward FROM milestones WHERE id = ?', 
            [milestoneId]
        );
        const xpReward = milestoneInfo[0].xp_reward || 0;

        // 3. Registra a conquista
        await connection.execute(
            'INSERT INTO child_milestones (child_id, milestone_id, data_conquista) VALUES (?, ?, NOW())',
            [childId, milestoneId]
        );

        // 4. Dá o XP para a criança (apenas XP, não Saldo, pois é um marco de vida, não trabalho)
        await connection.execute(
            'UPDATE children SET xp = xp + ? WHERE id = ?',
            [xpReward, childId]
        );

        await connection.commit();
        res.json({ mensagem: 'Conquista desbloqueada com sucesso!' });

    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ mensagem: 'Erro ao desbloquear conquista.' });
    } finally {
        connection.release();
    }
};