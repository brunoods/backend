const db = require('../config/db');

exports.create = async (parentId, { nome, pontos, frequencia, targetChildId, deadline }) => {
    const [res] = await db.execute(
        'INSERT INTO tasks (parent_id, nome, pontos, frequencia, target_child_id, deadline, completed) VALUES (?, ?, ?, ?, ?, ?, 0)',
        [parentId, nome, pontos, frequencia || 'unica', targetChildId || null, deadline || null]
    );
    return res.insertId;
};

exports.list = async (parentId, childId, apenasConcluidas) => {
    
    // =================================================================================
    // 1. LÓGICA DE RESET ROBUSTA (Listar IDs -> Resetar por ID)
    // =================================================================================
    
    if (childId) {
        try {
            // A. Busca tarefas DIÁRIAS que precisam de reset
            // Usa DATE_SUB(..., INTERVAL 3 HOUR) para ajustar o fuso horário do Brasil (UTC-3)
            const [dailyResetCandidates] = await db.execute(`
                SELECT id, nome FROM tasks 
                WHERE parent_id = ? 
                AND (target_child_id = ? OR target_child_id IS NULL)
                AND frequencia = 'diaria' 
                AND completed = 1 
                AND DATE(DATE_SUB(data_ultima_conclusao, INTERVAL 3 HOUR)) < DATE(DATE_SUB(NOW(), INTERVAL 3 HOUR))
            `, [parentId, childId]);

            // B. Busca tarefas SEMANAIS que precisam de reset
            const [weeklyResetCandidates] = await db.execute(`
                SELECT id, nome FROM tasks 
                WHERE parent_id = ? 
                AND (target_child_id = ? OR target_child_id IS NULL)
                AND frequencia = 'semanal' 
                AND completed = 1 
                AND YEARWEEK(DATE_SUB(data_ultima_conclusao, INTERVAL 3 HOUR), 1) < YEARWEEK(DATE_SUB(NOW(), INTERVAL 3 HOUR), 1)
            `, [parentId, childId]);

            // C. Executa o Reset se houver candidatos
            const idsToReset = [
                ...dailyResetCandidates.map(t => t.id),
                ...weeklyResetCandidates.map(t => t.id)
            ];

            if (idsToReset.length > 0) {
                console.log(`🔄 Resetando tarefas recorrentes (IDs: ${idsToReset.join(', ')})`);
                
                // Cria uma string de placeholders (?,?,?)
                const placeholders = idsToReset.map(() => '?').join(',');
                
                await db.execute(
                    `UPDATE tasks SET completed = 0 WHERE id IN (${placeholders})`,
                    idsToReset
                );
            }

        } catch (resetError) {
            console.error('⚠️ Erro ao tentar resetar tarefas:', resetError.message);
            // Não paramos o fluxo, apenas logamos o erro e continuamos a listagem
        }
    }

    // =================================================================================
    // 2. BUSCA DAS TAREFAS
    // =================================================================================
    
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