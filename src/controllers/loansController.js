const db = require('../config/db');

// Listar dívidas pendentes
exports.getLoans = async (req, res) => {
    try {
        const { childId } = req.params;
        const [loans] = await db.execute(
            "SELECT * FROM loans WHERE child_id = ? AND status = 'pendente' ORDER BY created_at DESC", 
            [childId]
        );
        res.json(loans);
    } catch (error) {
        res.status(500).json({ mensagem: 'Erro ao buscar dívidas.' });
    }
};

// Criar nova dívida (Adiantamento)
exports.createLoan = async (req, res) => {
    try {
        const { childId, descricao, valor } = req.body;
        if (!descricao || !valor) return res.status(400).json({ mensagem: 'Dados incompletos.' });

        await db.execute(
            'INSERT INTO loans (child_id, descricao, valor_total) VALUES (?, ?, ?)',
            [childId, descricao, valor]
        );
        res.status(201).json({ mensagem: 'Dívida registrada!' });
    } catch (error) {
        res.status(500).json({ mensagem: 'Erro ao criar dívida.' });
    }
};

// Abater Dívida (Pagar com saldo)
exports.payLoan = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;
        const { valorPagamento } = req.body; // Quanto vai pagar agora

        // 1. Busca a dívida
        const [loans] = await connection.execute('SELECT * FROM loans WHERE id = ?', [id]);
        if (loans.length === 0) throw new Error('Dívida não encontrada.');
        const loan = loans[0];

        // 2. Verifica saldo da criança
        const [children] = await connection.execute('SELECT pontos FROM children WHERE id = ?', [loan.child_id]);
        const saldoAtual = children[0].pontos;

        if (saldoAtual < valorPagamento) {
            throw new Error(`Saldo insuficiente. A criança só tem ${saldoAtual} pontos.`);
        }

        // 3. Verifica se o pagamento não excede a dívida
        const faltaPagar = loan.valor_total - loan.valor_pago;
        if (valorPagamento > faltaPagar) {
            throw new Error(`O valor excede a dívida. Restam apenas ${faltaPagar} para pagar.`);
        }

        // 4. Desconta do saldo da criança
        await connection.execute(
            'UPDATE children SET pontos = pontos - ? WHERE id = ?', 
            [valorPagamento, loan.child_id]
        );

        // 5. Atualiza a dívida
        const novoValorPago = loan.valor_pago + valorPagamento;
        const novoStatus = novoValorPago >= loan.valor_total ? 'pago' : 'pendente';

        await connection.execute(
            'UPDATE loans SET valor_pago = ?, status = ? WHERE id = ?',
            [novoValorPago, novoStatus, id]
        );

        // 6. Regista no Extrato
        await connection.execute(
            'INSERT INTO points_history (child_id, pontos, tipo, motivo) VALUES (?, ?, ?, ?)',
            [loan.child_id, -valorPagamento, 'perda', `Pagamento de Dívida: ${loan.descricao}`]
        );

        await connection.commit();
        res.json({ mensagem: 'Pagamento realizado com sucesso!' });

    } catch (error) {
        await connection.rollback();
        res.status(400).json({ mensagem: error.message || 'Erro ao pagar dívida.' });
    } finally {
        connection.release();
    }
};

// Deletar Dívida (Perdoar)
exports.deleteLoan = async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM loans WHERE id = ?', [id]);
        res.json({ mensagem: 'Dívida removida (perdoada).' });
    } catch (error) {
        res.status(500).json({ mensagem: 'Erro ao remover dívida.' });
    }
};