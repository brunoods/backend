const db = require('../config/db');

exports.completeTask = async (childId, taskId) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Busca a tarefa
        const [tasks] = await conn.execute('SELECT id, nome, pontos, completed, frequencia FROM tasks WHERE id = ?', [taskId]);
        if (tasks.length === 0) throw new Error('Tarefa não encontrada.');
        const task = tasks[0];

        // 2. Validação: Impede concluir se já estiver feita HOJE (segurança extra)
        // Nota: Se for não-recorrente, ela vai ser deletada, então essa validação serve mais para as recorrentes.
        if (task.completed === 1) {
            throw new Error('Esta tarefa já foi concluída hoje/agora.');
        }

        // 3. Lógica de Conclusão Baseada na Frequência
        const isRecurring = ['diaria', 'semanal'].includes(task.frequencia);

        if (isRecurring) {
            // --- TAREFA RECORRENTE ---
            // Marca como concluída (vai para a aba "Feitas" e reseta depois)
            await conn.execute(
                'UPDATE tasks SET completed = 1, data_ultima_conclusao = NOW() WHERE id = ?',
                [taskId]
            );

            // Mantém o registro histórico na tabela auxiliar para estatísticas
            await conn.execute(
                'INSERT INTO assigned_tasks (child_id, task_id, status, data) VALUES (?, ?, ?, NOW())',
                [childId, taskId, 'aprovado']
            );

        } else {
            // --- TAREFA ÚNICA / NÃO RECORRENTE ---
            // Remove a tarefa do banco de dados permanentemente
            await conn.execute('DELETE FROM tasks WHERE id = ?', [taskId]);
            
            // Nota: Não inserimos em 'assigned_tasks' aqui para evitar erro de chave estrangeira,
            // já que a tarefa pai acabou de ser deletada.
        }

        // 4. Dá os pontos à criança (Comum para ambos os casos)
        await conn.execute(
            'UPDATE children SET pontos = pontos + ?, xp = xp + ? WHERE id = ?',
            [task.pontos, task.pontos, childId]
        );

        // 5. Extrato Financeiro (Sempre registra, pois guarda o NOME da tarefa e não o ID)
        await conn.execute(
            'INSERT INTO points_history (child_id, pontos, tipo, motivo) VALUES (?, ?, ?, ?)',
            [childId, task.pontos, 'ganho', `Tarefa: ${task.nome}`]
        );

        await conn.commit();
        return task.pontos;
    } catch (e) {
        await conn.rollback();
        throw e;
    } finally {
        conn.release();
    }
};

exports.manualAdjustment = async (childId, pontos, motivo) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        if (pontos > 0) {
            await conn.execute(
                'UPDATE children SET pontos = pontos + ?, xp = xp + ? WHERE id = ?',
                [pontos, pontos, childId]
            );
        } else {
            await conn.execute(
                'UPDATE children SET pontos = pontos + ? WHERE id = ?',
                [pontos, childId]
            );
        }

        const tipo = pontos > 0 ? 'ganho' : 'perda';
        await conn.execute(
            'INSERT INTO points_history (child_id, pontos, tipo, motivo) VALUES (?, ?, ?, ?)',
            [childId, pontos, tipo, motivo]
        );

        await conn.commit();
    } catch (e) {
        await conn.rollback();
        throw e;
    } finally {
        conn.release();
    }
};

exports.getStatement = async (childId) => {
    const [historico] = await db.execute(
        'SELECT * FROM points_history WHERE child_id = ? ORDER BY created_at DESC LIMIT 50',
        [childId]
    );
    return historico;
};

exports.payAllowance = async (childId, valorEmReais) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [childRows] = await conn.execute('SELECT pontos FROM children WHERE id = ?', [childId]);
        if (childRows.length === 0) throw new Error('Criança não encontrada');
        
        const pontosAtuais = childRows[0].pontos;

        if (pontosAtuais <= 0) {
            throw new Error('Saldo zerado ou negativo. Nada a pagar.');
        }

        await conn.execute(
            'INSERT INTO points_history (child_id, pontos, tipo, motivo) VALUES (?, ?, ?, ?)',
            [childId, -pontosAtuais, 'perda', `💰 Pagamento de Mesada (R$ ${valorEmReais})`]
        );

        await conn.execute(
            'UPDATE children SET pontos = 0 WHERE id = ?',
            [childId]
        );

        await conn.commit();
    } catch (e) {
        await conn.rollback();
        throw e;
    } finally {
        conn.release();
    }
};