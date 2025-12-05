const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// Listar metas
exports.getGoals = asyncHandler(async (req, res) => {
    const { childId } = req.params;
    const [goals] = await db.execute('SELECT * FROM savings_goals WHERE child_id = ?', [childId]);
    res.json(goals);
});

// Criar meta
exports.createGoal = asyncHandler(async (req, res) => {
    const { childId, titulo, valorMeta, icone } = req.body;
    if (!titulo || !valorMeta) {
        const error = new Error('Dados incompletos.');
        error.statusCode = 400;
        throw error;
    }

    await db.execute(
        'INSERT INTO savings_goals (child_id, titulo, valor_meta, icone) VALUES (?, ?, ?, ?)',
        [childId, titulo, valorMeta, icone || '🐷']
    );
    res.status(201).json({ mensagem: 'Meta criada!' });
});

// Editar meta
exports.updateGoal = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { titulo, valorMeta } = req.body;

    if (!titulo || !valorMeta) {
        const error = new Error('Dados incompletos.');
        error.statusCode = 400;
        throw error;
    }

    await db.execute(
        'UPDATE savings_goals SET titulo = ?, valor_meta = ? WHERE id = ?',
        [titulo, valorMeta, id]
    );
    res.json({ mensagem: 'Meta atualizada!' });
});

// Deletar meta (Transação)
exports.deleteGoal = asyncHandler(async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;

        const [goals] = await connection.execute('SELECT child_id, titulo, saldo_guardado FROM savings_goals WHERE id = ?', [id]);
        if (goals.length === 0) {
            const error = new Error('Meta não encontrada.');
            error.statusCode = 404;
            throw error;
        }
        
        const { child_id, titulo, saldo_guardado } = goals[0];

        if (saldo_guardado > 0) {
            await connection.execute('UPDATE children SET pontos = pontos + ? WHERE id = ?', [saldo_guardado, child_id]);
            
            await connection.execute(
                'INSERT INTO points_history (child_id, pontos, tipo, motivo) VALUES (?, ?, ?, ?)',
                [child_id, saldo_guardado, 'ganho', `Cofre Excluído: ${titulo}`]
            );
        }

        await connection.execute('DELETE FROM savings_goals WHERE id = ?', [id]);

        await connection.commit();
        res.json({ mensagem: 'Meta removida e saldo devolvido.' });
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
});

// Movimentar (Transação)
exports.moveBalance = asyncHandler(async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const { goalId, valor, tipo } = req.body; 

        const [goals] = await connection.execute('SELECT * FROM savings_goals WHERE id = ?', [goalId]);
        if (goals.length === 0) throw new Error('Meta não encontrada');
        const goal = goals[0];

        const [children] = await connection.execute('SELECT pontos FROM children WHERE id = ?', [goal.child_id]);
        const saldoDisponivel = children[0].pontos;

        if (tipo === 'depositar') {
            if (saldoDisponivel < valor) throw new Error('Saldo principal insuficiente.');
            
            await connection.execute('UPDATE children SET pontos = pontos - ? WHERE id = ?', [valor, goal.child_id]);
            await connection.execute('UPDATE savings_goals SET saldo_guardado = saldo_guardado + ? WHERE id = ?', [valor, goalId]);
            
            await connection.execute(
                'INSERT INTO points_history (child_id, pontos, tipo, motivo) VALUES (?, ?, ?, ?)',
                [goal.child_id, -valor, 'perda', `Guardou em: ${goal.titulo}`]
            );
        
        } else if (tipo === 'resgatar') {
            if (goal.saldo_guardado < valor) throw new Error('Saldo no cofre insuficiente.');

            await connection.execute('UPDATE savings_goals SET saldo_guardado = saldo_guardado - ? WHERE id = ?', [valor, goalId]);
            await connection.execute('UPDATE children SET pontos = pontos + ? WHERE id = ?', [valor, goal.child_id]);

            await connection.execute(
                'INSERT INTO points_history (child_id, pontos, tipo, motivo) VALUES (?, ?, ?, ?)',
                [goal.child_id, valor, 'ganho', `Resgate de: ${goal.titulo}`]
            );
        }

        await connection.commit();
        res.json({ mensagem: 'Movimentação realizada!' });

    } catch (error) {
        await connection.rollback();
        error.statusCode = 400; // Define como erro de negócio
        throw error;
    } finally {
        connection.release();
    }
});

// Aplicar Juros (Transação)
exports.applyInterest = asyncHandler(async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const { goalId, percentual } = req.body;

        const [goals] = await connection.execute('SELECT * FROM savings_goals WHERE id = ?', [goalId]);
        if (goals.length === 0) throw new Error('Meta não encontrada');
        const goal = goals[0];

        if (goal.saldo_guardado <= 0) throw new Error('Cofre vazio. Nada para render.');

        const rendimento = Math.round(goal.saldo_guardado * (percentual / 100));
        
        if (rendimento <= 0) throw new Error('Rendimento muito baixo (< 1 ponto).');

        await connection.execute('UPDATE savings_goals SET saldo_guardado = saldo_guardado + ? WHERE id = ?', [rendimento, goalId]);

        await connection.execute(
            'INSERT INTO points_history (child_id, pontos, tipo, motivo) VALUES (?, ?, ?, ?)',
            [goal.child_id, rendimento, 'ganho', `📈 Rendimento: ${goal.titulo} (+${percentual}%)`]
        );

        await connection.commit();
        res.json({ mensagem: `Rendimento de ${rendimento} pontos aplicado!` });

    } catch (error) {
        await connection.rollback();
        error.statusCode = 400;
        throw error;
    } finally {
        connection.release();
    }
});