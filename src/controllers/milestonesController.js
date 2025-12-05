const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

exports.getMilestones = asyncHandler(async (req, res) => {
    const { childId } = req.params;

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
});

// Opcional: Desbloquear manualmente
exports.desbloquearConquista = asyncHandler(async (req, res) => {
    const { childId, milestoneId } = req.body;
    
    const [check] = await db.execute(
        'SELECT id FROM child_milestones WHERE child_id = ? AND milestone_id = ?', 
        [childId, milestoneId]
    );

    if (check.length > 0) {
        const error = new Error('Conquista já desbloqueada.');
        error.statusCode = 400;
        throw error;
    }

    await db.execute(
        'INSERT INTO child_milestones (child_id, milestone_id) VALUES (?, ?)',
        [childId, milestoneId]
    );

    res.json({ mensagem: 'Conquista desbloqueada!' });
});

// Marcar conquista e dar XP (Transação)
exports.toggleMilestone = asyncHandler(async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { childId, milestoneId } = req.body;

        const [existing] = await connection.execute(
            'SELECT * FROM child_milestones WHERE child_id = ? AND milestone_id = ?',
            [childId, milestoneId]
        );

        if (existing.length > 0) {
            const error = new Error('Esta conquista já foi registrada!');
            error.statusCode = 400;
            throw error;
        }

        const [milestoneInfo] = await connection.execute(
            'SELECT xp_reward FROM milestones WHERE id = ?', 
            [milestoneId]
        );
        const xpReward = milestoneInfo[0].xp_reward || 0;

        await connection.execute(
            'INSERT INTO child_milestones (child_id, milestone_id, data_conquista) VALUES (?, ?, NOW())',
            [childId, milestoneId]
        );

        await connection.execute(
            'UPDATE children SET xp = xp + ? WHERE id = ?',
            [xpReward, childId]
        );

        await connection.commit();
        res.json({ mensagem: 'Conquista desbloqueada com sucesso!' });

    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
});