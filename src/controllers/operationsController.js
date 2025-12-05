const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// 1. Registrar Tarefa Feita (Transação)
exports.realizarTarefa = asyncHandler(async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { childId, taskId } = req.body;

        const [tasks] = await connection.execute('SELECT nome, pontos FROM tasks WHERE id = ?', [taskId]);
        if (tasks.length === 0) throw new Error('Tarefa não encontrada.');
        const task = tasks[0];

        await connection.execute(
            'INSERT INTO assigned_tasks (child_id, task_id, status, data) VALUES (?, ?, ?, NOW())',
            [childId, taskId, 'aprovado']
        );

        await connection.execute(
            'UPDATE children SET pontos = pontos + ?, xp = xp + ? WHERE id = ?',
            [task.pontos, task.pontos, childId]
        );

        await connection.execute(
            'INSERT INTO points_history (child_id, pontos, tipo, motivo) VALUES (?, ?, ?, ?)',
            [childId, task.pontos, 'ganho', `Tarefa: ${task.nome}`]
        );

        await connection.commit();
        res.status(200).json({ 
            mensagem: `Sucesso! +${task.pontos} pontos e XP para a criança.`,
            pontosGanhos: task.pontos 
        });

    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
});

// 2. Ajuste Manual (Transação)
exports.ajusteManual = asyncHandler(async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { childId, pontos, motivo } = req.body; 

        if (pontos > 0) {
            await connection.execute(
                'UPDATE children SET pontos = pontos + ?, xp = xp + ? WHERE id = ?',
                [pontos, pontos, childId]
            );
        } else {
            await connection.execute(
                'UPDATE children SET pontos = pontos + ? WHERE id = ?',
                [pontos, childId]
            );
        }

        const tipo = pontos > 0 ? 'ganho' : 'perda';
        await connection.execute(
            'INSERT INTO points_history (child_id, pontos, tipo, motivo) VALUES (?, ?, ?, ?)',
            [childId, pontos, tipo, motivo]
        );

        await connection.commit();
        res.status(200).json({ mensagem: 'Saldo atualizado com sucesso.' });

    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
});

// 3. Ver Extrato
exports.verExtrato = asyncHandler(async (req, res) => {
    const { childId } = req.params;
    const [historico] = await db.execute(
        'SELECT * FROM points_history WHERE child_id = ? ORDER BY created_at DESC LIMIT 50',
        [childId]
    );
    res.json(historico);
});

// 4. Pagar Mesada (Transação)
exports.pagarMesada = asyncHandler(async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const { childId, valorEmReais } = req.body;

        const [childRows] = await connection.execute('SELECT pontos FROM children WHERE id = ?', [childId]);
        if (childRows.length === 0) throw new Error('Criança não encontrada');
        
        const pontosAtuais = childRows[0].pontos;

        if (pontosAtuais <= 0) {
            const error = new Error('Saldo zerado ou negativo. Nada a pagar.');
            error.statusCode = 400;
            throw error;
        }

        await connection.execute(
            'INSERT INTO points_history (child_id, pontos, tipo, motivo) VALUES (?, ?, ?, ?)',
            [childId, -pontosAtuais, 'perda', `💰 Pagamento de Mesada (R$ ${valorEmReais})`]
        );

        await connection.execute(
            'UPDATE children SET pontos = 0 WHERE id = ?',
            [childId]
        );

        await connection.commit();
        res.status(200).json({ mensagem: 'Pagamento registrado e saldo zerado! Nível mantido.' });

    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
});