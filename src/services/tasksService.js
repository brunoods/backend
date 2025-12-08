const db = require('../config/db');

exports.create = async (parentId, { nome, pontos, frequencia, targetChildId, deadline }) => {
    const [res] = await db.execute(
        'INSERT INTO tasks (parent_id, nome, pontos, frequencia, target_child_id, deadline, completed) VALUES (?, ?, ?, ?, ?, ?, 0)',
        [parentId, nome, pontos, frequencia || 'unica', targetChildId || null, deadline || null]
    );
    return res.insertId;
};

exports.list = async (parentId, childId, apenasConcluidas) => {
    // 1. LÓGICA DE RESET AUTOMÁTICO (O "Pulo do Gato")
    // Antes de listar, verificamos se alguma tarefa recorrente precisa voltar a ser pendente.
    
    if (childId) {
        // Resetar DIÁRIAS: Se foi feita antes de hoje
        await db.execute(`
            UPDATE tasks 
            SET completed = 0 
            WHERE parent_id = ? 
            AND (target_child_id = ? OR target_child_id IS NULL)
            AND frequencia = 'diaria' 
            AND completed = 1 
            AND DATE(data_ultima_conclusao) < CURDATE()
        `, [parentId, childId]);

        // Resetar SEMANAIS: Se a semana do ano mudou
        await db.execute(`
            UPDATE tasks 
            SET completed = 0 
            WHERE parent_id = ? 
            AND (target_child_id = ? OR target_child_id IS NULL)
            AND frequencia = 'semanal' 
            AND completed = 1 
            AND YEARWEEK(data_ultima_conclusao, 1) < YEARWEEK(NOW(), 1)
        `, [parentId, childId]);
    }

    // 2. BUSCA DAS TAREFAS
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

    // Se o frontend mandar ?concluida=true, filtramos aqui (opcional)
    // Mas geralmente o teu front pede tudo e separa nas abas.
    if (apenasConcluidas !== undefined) {
        query += ' AND completed = ?';
        params.push(apenasConcluidas === 'true' ? 1 : 0);
    }

    // Ordenação: Pendentes primeiro, depois por prazo
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