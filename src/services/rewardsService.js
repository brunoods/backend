const db = require('../config/db');

exports.create = async ({ parentId, nome, custo, icone }) => {
    const [result] = await db.execute(
        'INSERT INTO rewards (parent_id, nome, custo, icone) VALUES (?, ?, ?, ?)',
        [parentId, nome, custo, icone || '🎁']
    );
    return result.insertId;
};

exports.list = async (parentId) => {
    const [rows] = await db.execute(
        'SELECT * FROM rewards WHERE parent_id = ? ORDER BY custo ASC',
        [parentId]
    );
    return rows;
};

exports.delete = async (id, parentId) => {
    await db.execute('DELETE FROM rewards WHERE id = ? AND parent_id = ?', [id, parentId]);
};