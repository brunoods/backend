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
    // LÓGICA DE RESET (CICLO DE VIDA DA TAREFA)
    // Objetivo: Fazer a tarefa voltar a "Pendente" assim que passar da Meia-Noite.
    // =================================================================================
    
    if (childId) {
        try {
            // Ajuste de Fuso Horário: -3 Horas (Brasil)
            // Se o servidor for UTC (00:00), subtraímos 3h para ser 21:00 do dia anterior.
            // Assim, a "Meia Noite" real só acontece quando o servidor bater 03:00.
            const FUSO_HORARIO = 'INTERVAL 3 HOUR'; 

            // 1. Resetar Tarefas DIÁRIAS
            // Lógica: Se a data da conclusão (ajustada) for menor que a data de hoje (ajustada).
            // Ex: Concluiu dia 08. Hoje é dia 09. 08 < 09? Sim -> Reseta.
            const [dailyResetCandidates] = await db.execute(`
                SELECT id FROM tasks 
                WHERE parent_id = ? 
                AND (target_child_id = ? OR target_child_id IS NULL)
                AND frequencia = 'diaria' 
                AND completed = 1 
                AND DATE(DATE_SUB(data_ultima_conclusao, ${FUSO_HORARIO})) < DATE(DATE_SUB(NOW(), ${FUSO_HORARIO}))
            `, [parentId, childId]);

            // 2. Resetar Tarefas SEMANAIS
            // Lógica: Se a semana do ano mudou (segunda-feira é o start).
            const [weeklyResetCandidates] = await db.execute(`
                SELECT id FROM tasks 
                WHERE parent_id = ? 
                AND (target_child_id = ? OR target_child_id IS NULL)
                AND frequencia = 'semanal' 
                AND completed = 1 
                AND YEARWEEK(DATE_SUB(data_ultima_conclusao, ${FUSO_HORARIO}), 1) < YEARWEEK(DATE_SUB(NOW(), ${FUSO_HORARIO}), 1)
            `, [parentId, childId]);

            // 3. Executa o Reset (Update em massa)
            const idsToReset = [
                ...dailyResetCandidates.map(t => t.id),
                ...weeklyResetCandidates.map(t => t.id)
            ];

            if (idsToReset.length > 0) {
                console.log(`🌙 Meia-Noite chegou! Resetando tarefas: ${idsToReset.join(', ')}`);
                
                // Truque para criar a string de interrogações (?,?,?)
                const placeholders = idsToReset.map(() => '?').join(',');
                
                await db.execute(
                    `UPDATE tasks SET completed = 0 WHERE id IN (${placeholders})`,
                    idsToReset
                );
            }

        } catch (resetError) {
            console.error('⚠️ Erro no reset automático:', resetError.message);
        }
    }

    // =================================================================================
    // BUSCA DAS TAREFAS (Retorna a lista atualizada)
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