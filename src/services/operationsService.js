const db = require('../config/db');

exports.completeTask = async (childId, taskId) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [tasks] = await conn.execute('SELECT nome, pontos FROM tasks WHERE id = ?', [taskId]);
        if (tasks.length === 0) throw new Error('Tarefa não encontrada.');
        const task = tasks[0];

        await conn.execute(
            'INSERT INTO assigned_tasks (child_id, task_id, status, data) VALUES (?, ?, ?, NOW())',
            [childId, taskId, 'aprovado']
        );

        await conn.execute(
            'UPDATE children SET pontos = pontos + ?, xp = xp + ? WHERE id = ?',
            [task.pontos, task.pontos, childId]
        );

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