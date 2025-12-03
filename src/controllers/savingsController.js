const db = require('../config/db');

// Listar metas da criança
exports.getGoals = async (req, res) => {
    try {
        const { childId } = req.params;
        const [goals] = await db.execute('SELECT * FROM savings_goals WHERE child_id = ?', [childId]);
        res.json(goals);
    } catch (error) {
        res.status(500).json({ mensagem: 'Erro ao buscar metas.' });
    }
};

// Criar nova meta
exports.createGoal = async (req, res) => {
    try {
        const { childId, titulo, valorMeta, icone } = req.body;
        if (!titulo || !valorMeta) return res.status(400).json({ mensagem: 'Dados incompletos.' });

        await db.execute(
            'INSERT INTO savings_goals (child_id, titulo, valor_meta, icone) VALUES (?, ?, ?, ?)',
            [childId, titulo, valorMeta, icone || '🐷']
        );
        res.status(201).json({ mensagem: 'Meta criada!' });
    } catch (error) {
        res.status(500).json({ mensagem: 'Erro ao criar meta.' });
    }
};

// Editar meta
exports.updateGoal = async (req, res) => {
    try {
        const { id } = req.params;
        const { titulo, valorMeta } = req.body;

        if (!titulo || !valorMeta) return res.status(400).json({ mensagem: 'Dados incompletos.' });

        await db.execute(
            'UPDATE savings_goals SET titulo = ?, valor_meta = ? WHERE id = ?',
            [titulo, valorMeta, id]
        );
        res.json({ mensagem: 'Meta atualizada!' });
    } catch (error) {
        res.status(500).json({ mensagem: 'Erro ao atualizar meta.' });
    }
};

// Deletar meta (Devolve o dinheiro para a conta principal)
exports.deleteGoal = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;

        // 1. Pega o saldo que estava no cofre
        const [goals] = await connection.execute('SELECT child_id, titulo, saldo_guardado FROM savings_goals WHERE id = ?', [id]);
        if (goals.length === 0) return res.status(404).json({ mensagem: 'Meta não encontrada.' });
        
        const { child_id, titulo, saldo_guardado } = goals[0];

        // 2. Devolve para a criança se tiver saldo
        if (saldo_guardado > 0) {
            await connection.execute('UPDATE children SET pontos = pontos + ? WHERE id = ?', [saldo_guardado, child_id]);
            
            // Regista no histórico a devolução
            await connection.execute(
                'INSERT INTO points_history (child_id, pontos, tipo, motivo) VALUES (?, ?, ?, ?)',
                [child_id, saldo_guardado, 'ganho', `Cofre Excluído: ${titulo}`]
            );
        }

        // 3. Deleta a meta
        await connection.execute('DELETE FROM savings_goals WHERE id = ?', [id]);

        await connection.commit();
        res.json({ mensagem: 'Meta removida e saldo devolvido.' });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ mensagem: 'Erro ao deletar meta.' });
    } finally {
        connection.release();
    }
};

// Movimentar (Depositar ou Resgatar) + Extrato
exports.moveBalance = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const { goalId, valor, tipo } = req.body; // tipo: 'depositar' ou 'resgatar'

        // Busca meta e saldo atual da criança
        const [goals] = await connection.execute('SELECT * FROM savings_goals WHERE id = ?', [goalId]);
        if (goals.length === 0) throw new Error('Meta não encontrada');
        const goal = goals[0];

        const [children] = await connection.execute('SELECT pontos FROM children WHERE id = ?', [goal.child_id]);
        const saldoDisponivel = children[0].pontos;

        if (tipo === 'depositar') {
            if (saldoDisponivel < valor) throw new Error('Saldo principal insuficiente.');
            
            // Tira do Principal -> Põe no Cofre
            await connection.execute('UPDATE children SET pontos = pontos - ? WHERE id = ?', [valor, goal.child_id]);
            await connection.execute('UPDATE savings_goals SET saldo_guardado = saldo_guardado + ? WHERE id = ?', [valor, goalId]);
            
            // Histórico: Saiu do principal (Perda na conta corrente, Ganho no cofre)
            await connection.execute(
                'INSERT INTO points_history (child_id, pontos, tipo, motivo) VALUES (?, ?, ?, ?)',
                [goal.child_id, -valor, 'perda', `Guardou em: ${goal.titulo}`]
            );
        
        } else if (tipo === 'resgatar') {
            if (goal.saldo_guardado < valor) throw new Error('Saldo no cofre insuficiente.');

            // Tira do Cofre -> Põe no Principal
            await connection.execute('UPDATE savings_goals SET saldo_guardado = saldo_guardado - ? WHERE id = ?', [valor, goalId]);
            await connection.execute('UPDATE children SET pontos = pontos + ? WHERE id = ?', [valor, goal.child_id]);

            // Histórico: Voltou para o principal
            await connection.execute(
                'INSERT INTO points_history (child_id, pontos, tipo, motivo) VALUES (?, ?, ?, ?)',
                [goal.child_id, valor, 'ganho', `Resgate de: ${goal.titulo}`]
            );
        }

        await connection.commit();
        res.json({ mensagem: 'Movimentação realizada!' });

    } catch (error) {
        await connection.rollback();
        res.status(400).json({ mensagem: error.message || 'Erro na movimentação.' });
    } finally {
        connection.release();
    }
};

// Aplicar Rendimentos (Banco do Pai)
exports.applyInterest = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const { goalId, percentual } = req.body;

        // 1. Busca a meta
        const [goals] = await connection.execute('SELECT * FROM savings_goals WHERE id = ?', [goalId]);
        if (goals.length === 0) throw new Error('Meta não encontrada');
        const goal = goals[0];

        if (goal.saldo_guardado <= 0) throw new Error('Cofre vazio. Nada para render.');

        // 2. Calcula rendimento (arredondado)
        const rendimento = Math.round(goal.saldo_guardado * (percentual / 100));
        
        if (rendimento <= 0) throw new Error('Rendimento muito baixo (< 1 ponto).');

        // 3. Adiciona ao saldo do cofre (NÃO sai do saldo da criança, o "Pai" cria o dinheiro)
        await connection.execute('UPDATE savings_goals SET saldo_guardado = saldo_guardado + ? WHERE id = ?', [rendimento, goalId]);

        // 4. Extrato (Opcional, mas bom para registo)
        await connection.execute(
            'INSERT INTO points_history (child_id, pontos, tipo, motivo) VALUES (?, ?, ?, ?)',
            [goal.child_id, rendimento, 'ganho', `📈 Rendimento: ${goal.titulo} (+${percentual}%)`]
        );

        await connection.commit();
        res.json({ mensagem: `Rendimento de ${rendimento} pontos aplicado!` });

    } catch (error) {
        await connection.rollback();
        res.status(400).json({ mensagem: error.message || 'Erro ao aplicar juros.' });
    } finally {
        connection.release();
    }
};