const db = require('../config/db');

exports.create = async (parentId, { nome, pontos, frequencia, targetChildId, deadline }) => {
    const [res] = await db.execute(
        'INSERT INTO tasks (parent_id, nome, pontos, frequencia, target_child_id, deadline, completed) VALUES (?, ?, ?, ?, ?, ?, 0)',
        [parentId, nome, pontos, frequencia || 'unica', targetChildId || null, deadline || null]
    );
    return res.insertId;
};

exports.list = async (parentId, childId, apenasConcluidas) => {
    // A lógica de reset automático foi movida para o Cron Job (dailyReset.js)
    // Isso torna esta resposta muito mais rápida para o utilizador.

    let query = `
        SELECT id, parent_id, nome, pontos, frequencia, target_child_id, deadline, completed, data_ultima_conclusao 
        FROM tasks 
        WHERE parent_id = ?
    `;
    const params = [parentId];

    if (childId) {
        query += ' AND (target_child_id = ? OR target_child_id IS NULL)';
        params.push(childId);
    }

    if (apenasConcluidas !== undefined) {
        query += ' AND completed = ?';
        params.push(apenasConcluidas === 'true' ? 1 : 0);
    }

    query += ' ORDER BY completed ASC, deadline ASC';

    const [rows] = await db.execute(query, params);
    return rows;
};

exports.update = async (parentId, id, { nome, pontos, frequencia, targetChildId, deadline }) => {
    const [result] = await db.execute(
        'UPDATE tasks SET nome = ?, pontos = ?, frequencia = ?, target_child_id = ?, deadline = ? WHERE id = ? AND parent_id = ?',
        [nome, pontos, frequencia || 'unica', targetChildId || null, deadline || null, id, parentId]
    );
    if (result.affectedRows === 0) throw new Error('Tarefa não encontrada ou não autorizada.');
};

exports.delete = async (parentId, id) => {
    const [result] = await db.execute(
        'DELETE FROM tasks WHERE id = ? AND parent_id = ?',
        [id, parentId]
    );
    if (result.affectedRows === 0) throw new Error('Tarefa não encontrada.');
};