const db = require('../config/db');

// 1. Registrar Tarefa Feita (Ganha Pontos + XP)
exports.realizarTarefa = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { childId, taskId } = req.body;

        // Busca tarefa para saber os pontos
        const [tasks] = await connection.execute('SELECT nome, pontos FROM tasks WHERE id = ?', [taskId]);
        if (tasks.length === 0) throw new Error('Tarefa não encontrada.');
        const task = tasks[0];

        // Registra na tabela de tarefas realizadas
        await connection.execute(
            'INSERT INTO assigned_tasks (child_id, task_id, status, data) VALUES (?, ?, ?, NOW())',
            [childId, taskId, 'aprovado']
        );

        // --- AQUI ESTÁ A MUDANÇA DA GAMIFICAÇÃO ---
        // Atualiza Saldo (pontos) E Experiência (xp)
        // O XP sobe junto com o saldo, mas não desce quando gasta.
        await connection.execute(
            'UPDATE children SET pontos = pontos + ?, xp = xp + ? WHERE id = ?',
            [task.pontos, task.pontos, childId]
        );

        // Gravar no histórico (Extrato)
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
        console.error(error);
        res.status(500).json({ mensagem: 'Erro ao registrar tarefa.' });
    } finally {
        connection.release();
    }
};

// 2. Ajuste Manual (Bônus dá XP, Punição/Gasto NÃO tira XP)
exports.ajusteManual = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { childId, pontos, motivo } = req.body; 

        if (pontos > 0) {
            // Se for GANHO (positivo), soma no XP também.
            await connection.execute(
                'UPDATE children SET pontos = pontos + ?, xp = xp + ? WHERE id = ?',
                [pontos, pontos, childId]
            );
        } else {
            // Se for PERDA (negativo), só mexe no saldo, o XP continua intacto.
            await connection.execute(
                'UPDATE children SET pontos = pontos + ? WHERE id = ?',
                [pontos, childId]
            );
        }

        // Registrar no histórico
        const tipo = pontos > 0 ? 'ganho' : 'perda';
        await connection.execute(
            'INSERT INTO points_history (child_id, pontos, tipo, motivo) VALUES (?, ?, ?, ?)',
            [childId, pontos, tipo, motivo]
        );

        await connection.commit();
        res.status(200).json({ mensagem: 'Saldo atualizado com sucesso.' });

    } catch (error) {
        await connection.rollback();
        res.status(500).json({ mensagem: 'Erro ao ajustar pontos.' });
    } finally {
        connection.release();
    }
};

// 3. Ver Extrato
exports.verExtrato = async (req, res) => {
    try {
        const { childId } = req.params;
        const [historico] = await db.execute(
            'SELECT * FROM points_history WHERE child_id = ? ORDER BY created_at DESC LIMIT 50',
            [childId]
        );
        res.json(historico);
    } catch (error) {
        res.status(500).json({ mensagem: 'Erro ao buscar extrato.' });
    }
};

// 4. Pagar Mesada (Zera saldo, Mantém XP)
exports.pagarMesada = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const { childId, valorEmReais } = req.body;

        // Busca o saldo atual
        const [childRows] = await connection.execute('SELECT pontos FROM children WHERE id = ?', [childId]);
        if (childRows.length === 0) throw new Error('Criança não encontrada');
        
        const pontosAtuais = childRows[0].pontos;

        if (pontosAtuais <= 0) {
            return res.status(400).json({ mensagem: 'Saldo zerado ou negativo. Nada a pagar.' });
        }

        // Registra a saída no histórico
        await connection.execute(
            'INSERT INTO points_history (child_id, pontos, tipo, motivo) VALUES (?, ?, ?, ?)',
            [childId, -pontosAtuais, 'perda', `💰 Pagamento de Mesada (R$ ${valorEmReais})`]
        );

        // --- AQUI ESTÁ A SEGURANÇA DO XP ---
        // Atualizamos APENAS a coluna 'pontos' para 0. A coluna 'xp' não é citada, logo não muda.
        await connection.execute(
            'UPDATE children SET pontos = 0 WHERE id = ?',
            [childId]
        );

        await connection.commit();
        res.status(200).json({ mensagem: 'Pagamento registrado e saldo zerado! Nível mantido.' });

    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ mensagem: 'Erro ao processar pagamento.' });
    } finally {
        connection.release();
    }
};