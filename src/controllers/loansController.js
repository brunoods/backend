const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// Listar dívidas
exports.getLoans = asyncHandler(async (req, res) => {
    const { childId } = req.params;
    const [loans] = await db.execute(
        "SELECT * FROM loans WHERE child_id = ? AND status = 'pendente' ORDER BY created_at DESC", 
        [childId]
    );
    res.json(loans);
});

// Criar dívida
exports.createLoan = asyncHandler(async (req, res) => {
    const { childId, descricao, valor } = req.body;
    if (!descricao || !valor) {
        const error = new Error('Dados incompletos.');
        error.statusCode = 400;
        throw error;
    }

    await db.execute(
        'INSERT INTO loans (child_id, descricao, valor_total) VALUES (?, ?, ?)',
        [childId, descricao, valor]
    );
    res.status(201).json({ mensagem: 'Dívida registrada!' });
});

// Pagar dívida (Transação)
exports.payLoan = asyncHandler(async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;
        const { valorPagamento } = req.body;

        const [loans] = await connection.execute('SELECT * FROM loans WHERE id = ?', [id]);
        if (loans.length === 0) throw new Error('Dívida não encontrada.');
        const loan = loans[0];

        const [children] = await connection.execute('SELECT pontos FROM children WHERE id = ?', [loan.child_id]);
        const saldoAtual = children[0].pontos;

        if (saldoAtual < valorPagamento) {
            throw new Error(`Saldo insuficiente. A criança só tem ${saldoAtual} pontos.`);
        }

        const faltaPagar = loan.valor_total - loan.valor_pago;
        if (valorPagamento > faltaPagar) {
            throw new Error(`O valor excede a dívida. Restam apenas ${faltaPagar} para pagar.`);
        }

        await connection.execute(
            'UPDATE children SET pontos = pontos - ? WHERE id = ?', 
            [valorPagamento, loan.child_id]
        );

        const novoValorPago = loan.valor_pago + valorPagamento;
        const novoStatus = novoValorPago >= loan.valor_total ? 'pago' : 'pendente';

        await connection.execute(
            'UPDATE loans SET valor_pago = ?, status = ? WHERE id = ?',
            [novoValorPago, novoStatus, id]
        );

        await connection.execute(
            'INSERT INTO points_history (child_id, pontos, tipo, motivo) VALUES (?, ?, ?, ?)',
            [loan.child_id, -valorPagamento, 'perda', `Pagamento de Dívida: ${loan.descricao}`]
        );

        await connection.commit();
        res.json({ mensagem: 'Pagamento realizado com sucesso!' });

    } catch (error) {
        await connection.rollback();
        error.statusCode = 400;
        throw error;
    } finally {
        connection.release();
    }
});

// Deletar dívida
exports.deleteLoan = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await db.execute('DELETE FROM loans WHERE id = ?', [id]);
    res.json({ mensagem: 'Dívida removida (perdoada).' });
});