const db = require('../config/db');

exports.getByChild = async (childId) => {
    const [rows] = await db.execute(`
        SELECT m.id, m.titulo, m.descricao, m.icone, m.xp_reward, m.faixa_etaria, cm.data_conquista
        FROM milestones m
        LEFT JOIN child_milestones cm ON m.id = cm.milestone_id AND cm.child_id = ?
        ORDER BY m.id ASC
    `, [childId]);
    return rows;
};

exports.unlockManually = async (childId, milestoneId) => {
    const [check] = await db.execute(
        'SELECT id FROM child_milestones WHERE child_id = ? AND milestone_id = ?', 
        [childId, milestoneId]
    );
    if (check.length > 0) throw new Error('Conquista já desbloqueada.');

    await db.execute(
        'INSERT INTO child_milestones (child_id, milestone_id) VALUES (?, ?)',
        [childId, milestoneId]
    );
};

exports.toggle = async (childId, milestoneId) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [existing] = await connection.execute(
            'SELECT * FROM child_milestones WHERE child_id = ? AND milestone_id = ?',
            [childId, milestoneId]
        );

        if (existing.length > 0) throw new Error('Esta conquista já foi registrada!');

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
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};