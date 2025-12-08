const db = require('../config/db');

exports.create = async (parentId, { nome, pontos, frequencia, targetChildId, deadline }) => {
    const [res] = await db.execute(
        'INSERT INTO tasks (parent_id, nome, pontos, frequencia, target_child_id, deadline) VALUES (?, ?, ?, ?, ?, ?)',
        [parentId, nome, pontos, frequencia || 'livre', targetChildId || null, deadline || null]
    );
    return res.insertId;
};

exports.list = async (parentId, childId) => {
    // Se não tiver childId (visão geral do pai), lista tudo
    if (!childId) {
        const [rows] = await db.execute(
            'SELECT * FROM tasks WHERE parent_id = ? ORDER BY deadline ASC', 
            [parentId]
        );
        return rows;
    }

    // Se tiver childId, aplica a lógica de esconder tarefas já feitas
    // Lógica:
    // 1. Seleciona tarefas do Pai E (que são para todos OU para este filho específico)
    // 2. E que NÃO EXISTAM na tabela de tarefas_realizadas (assigned_tasks) cumprindo os critérios de frequência
    const query = `
        SELECT t.* FROM tasks t
        WHERE t.parent_id = ?
        AND (t.target_child_id = ? OR t.target_child_id IS NULL)
        AND NOT EXISTS (
            SELECT 1 FROM assigned_tasks at
            WHERE at.task_id = t.id
            AND at.child_id = ?
            AND (
                -- Se for 'livre' (uma vez), esconde se tiver QUALQUER registro
                (t.frequencia = 'livre' OR t.frequencia IS NULL)
                
                -- Se for 'diaria', esconde se tiver registro HOJE
                OR (t.frequencia = 'diaria' AND DATE(at.data) = CURRENT_DATE())
                
                -- Se for 'semanal', esconde se tiver registro NESTA SEMANA (começando domingo)
                OR (t.frequencia = 'semanal' AND YEARWEEK(at.data, 1) = YEARWEEK(NOW(), 1))
            )
        )
        ORDER BY t.deadline ASC
    `;

    // Passamos childId duas vezes (uma para filtrar o alvo da tarefa, outra para o NOT EXISTS)
    const [rows] = await db.execute(query, [parentId, childId, childId]);
    return rows;
};

exports.update = async (parentId, id, { nome, pontos, frequencia, targetChildId, deadline }) => {
    const [result] = await db.execute(
        'UPDATE tasks SET nome = ?, pontos = ?, frequencia = ?, target_child_id = ?, deadline = ? WHERE id = ? AND parent_id = ?',
        [nome, pontos, frequencia || 'livre', targetChildId || null, deadline || null, id, parentId]
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