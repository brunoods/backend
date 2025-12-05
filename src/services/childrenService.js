const db = require('../config/db');

exports.listByParent = async (parentId) => {
    const [rows] = await db.execute('SELECT * FROM children WHERE parent_id = ?', [parentId]);
    return rows;
};

exports.create = async (parentId, { nome, avatar, dataNascimento, corFundo }) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [res] = await connection.execute(
            'INSERT INTO children (parent_id, nome, avatar, pontos, data_nascimento, cor_fundo) VALUES (?, ?, ?, 0, ?, ?)',
            [parentId, nome, avatar || 'default.png', dataNascimento || null, corFundo || '#F0F0F0']
        );
        const childId = res.insertId;
        let initialXp = 0;

        if (dataNascimento) {
            const [ms] = await connection.execute("SELECT id, xp_reward FROM milestones WHERE titulo LIKE 'Cheguei ao Mundo%' LIMIT 1");
            if (ms.length > 0) {
                await connection.execute('INSERT INTO child_milestones (child_id, milestone_id, data_conquista) VALUES (?, ?, ?)', [childId, ms[0].id, dataNascimento]);
                await connection.execute('UPDATE children SET xp = xp + ? WHERE id = ?', [ms[0].xp_reward, childId]);
                initialXp = ms[0].xp_reward;
            }
        }

        await connection.commit();
        return { id: childId, nome, avatar, corFundo, xp: initialXp };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

exports.update = async (parentId, id, { nome, avatar, dataNascimento, corFundo }) => {
    const [result] = await db.execute(
        'UPDATE children SET nome = ?, avatar = ?, data_nascimento = ?, cor_fundo = ? WHERE id = ? AND parent_id = ?',
        [nome, avatar, dataNascimento || null, corFundo || '#F0F0F0', id, parentId]
    );
    if (result.affectedRows === 0) throw new Error('Criança não encontrada ou não autorizada.');
};

exports.delete = async (parentId, id) => {
    const [result] = await db.execute(
        'DELETE FROM children WHERE id = ? AND parent_id = ?',
        [id, parentId]
    );
    if (result.affectedRows === 0) throw new Error('Criança não encontrada.');
};