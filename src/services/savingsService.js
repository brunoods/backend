const db = require('../config/db');

exports.listByChild = async (childId) => {
    const [rows] = await db.execute('SELECT * FROM savings_goals WHERE child_id = ?', [childId]);
    return rows;
};

exports.create = async ({ childId, titulo, valorMeta, icone }) => {
    await db.execute(
        'INSERT INTO savings_goals (child_id, titulo, valor_meta, icone) VALUES (?, ?, ?, ?)',
        [childId, titulo, valorMeta, icone || '🐷']
    );
};

exports.update = async (id, { titulo, valorMeta }) => {
    await db.execute(
        'UPDATE savings_goals SET titulo = ?, valor_meta = ? WHERE id = ?',
        [titulo, valorMeta, id]
    );
};

exports.delete = async (id) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [goals] = await connection.execute('SELECT child_id, titulo, saldo_guardado FROM savings_goals WHERE id = ?', [id]);
        if (goals.length === 0) throw new Error('Meta não encontrada.');
        
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
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

exports.moveBalance = async ({ goalId, valor, tipo }) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [goals] = await connection.execute('SELECT * FROM savings_goals WHERE id = ?', [goalId]);
        if (goals.length === 0) throw new Error('Meta não encontrada');
        const goal = goals[0];

        const [children] = await connection.execute('SELECT pontos FROM children WHERE id = ?', [goal.child_id]);
        const saldoDisponivel = children[0].pontos;

        if (tipo === 'depositar') {
            if (saldoDisponivel < valor) throw new Error('Saldo principal insuficiente.');
            await connection.execute('UPDATE children SET pontos = pontos - ? WHERE id = ?', [valor, goal.child_id]);
            await connection.execute('UPDATE savings_goals SET saldo_guardado = saldo_guardado + ? WHERE id = ?', [valor, goalId]);
            await connection.execute('INSERT INTO points_history (child_id, pontos, tipo, motivo) VALUES (?, ?, ?, ?)', [goal.child_id, -valor, 'perda', `Guardou em: ${goal.titulo}`]);
        } else if (tipo === 'resgatar') {
            if (goal.saldo_guardado < valor) throw new Error('Saldo no cofre insuficiente.');
            await connection.execute('UPDATE savings_goals SET saldo_guardado = saldo_guardado - ? WHERE id = ?', [valor, goalId]);
            await connection.execute('UPDATE children SET pontos = pontos + ? WHERE id = ?', [valor, goal.child_id]);
            await connection.execute('INSERT INTO points_history (child_id, pontos, tipo, motivo) VALUES (?, ?, ?, ?)', [goal.child_id, valor, 'ganho', `Resgate de: ${goal.titulo}`]);
        }

        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

exports.applyInterest = async (goalId, percentual) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [goals] = await connection.execute('SELECT * FROM savings_goals WHERE id = ?', [goalId]);
        if (goals.length === 0) throw new Error('Meta não encontrada');
        const goal = goals[0];

        if (goal.saldo_guardado <= 0) throw new Error('Cofre vazio. Nada para render.');

        const rendimento = Math.round(goal.saldo_guardado * (percentual / 100));
        if (rendimento <= 0) throw new Error('Rendimento muito baixo (< 1 ponto).');

        await connection.execute('UPDATE savings_goals SET saldo_guardado = saldo_guardado + ? WHERE id = ?', [rendimento, goalId]);
        await connection.execute('INSERT INTO points_history (child_id, pontos, tipo, motivo) VALUES (?, ?, ?, ?)', [goal.child_id, rendimento, 'ganho', `📈 Rendimento: ${goal.titulo} (+${percentual}%)`]);

        await connection.commit();
        return rendimento;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};