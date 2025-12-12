const savingsService = require('../services/savingsService');
const asyncHandler = require('../utils/asyncHandler');

exports.getGoals = asyncHandler(async (req, res) => {
    const goals = await savingsService.listByChild(req.params.childId);
    res.json(goals);
});

exports.createGoal = asyncHandler(async (req, res) => {
    const { childId, titulo, valorMeta, icone } = req.body;
    if (!titulo || !valorMeta) {
        const error = new Error('Dados incompletos.');
        error.statusCode = 400;
        throw error;
    }
    await savingsService.create({ childId, titulo, valorMeta, icone });
    res.status(201).json({ mensagem: 'Meta criada!' });
});

exports.updateGoal = asyncHandler(async (req, res) => {
    const { titulo, valorMeta } = req.body;
    if (!titulo || !valorMeta) {
        const error = new Error('Dados incompletos.');
        error.statusCode = 400;
        throw error;
    }
    await savingsService.update(req.params.id, { titulo, valorMeta });
    res.json({ mensagem: 'Meta atualizada!' });
});

exports.deleteGoal = asyncHandler(async (req, res) => {
    await savingsService.delete(req.params.id);
    res.json({ mensagem: 'Meta removida e saldo devolvido.' });
});

exports.moveBalance = asyncHandler(async (req, res) => {
    await savingsService.moveBalance(req.body);
    res.json({ mensagem: 'Movimentação realizada!' });
});

exports.applyInterest = asyncHandler(async (req, res) => {
    const rendimento = await savingsService.applyInterest(req.body.goalId, req.body.percentual);
    res.json({ mensagem: `Rendimento de ${rendimento} pontos aplicado!` });
});

// Adiciona isto ao final do savingsController.js

exports.transaction = async (req, res) => {
    const { id } = req.params; // ID do Cofre (ex: 11)
    const { childId, tipo, valor } = req.body; // Dados vindos do App

    try {
        // Ajusta 'Savings' e 'Child' para os nomes reais dos teus Models (ex: db.Savings, db.Child)
        // Se estiveres a usar Sequelize, deve ser algo como:
        const savings = await Savings.findByPk(id);
        const child = await Child.findByPk(childId);

        if (!savings || !child) {
            return res.status(404).json({ mensagem: 'Cofre ou Criança não encontrados.' });
        }

        // --- LÓGICA DE DEPÓSITO (Guardar) ---
        if (tipo === 'deposit') {
            if (child.pontos < valor) {
                return res.status(400).json({ mensagem: 'Saldo insuficiente na carteira.' });
            }
            child.pontos -= valor;           // Tira da carteira
            savings.saldo_guardado += valor; // Põe no cofre
        } 
        
        // --- LÓGICA DE RESGATE (Tirar) ---
        else if (tipo === 'withdraw') {
            if (savings.saldo_guardado < valor) {
                return res.status(400).json({ mensagem: 'Saldo insuficiente no cofre.' });
            }
            savings.saldo_guardado -= valor; // Tira do cofre
            child.pontos += valor;           // Devolve à carteira
        } 
        
        // --- LÓGICA DE JUROS (Bónus) ---
        else if (tipo === 'interest') {
             savings.saldo_guardado += valor; // Apenas adiciona ao cofre (dinheiro novo)
        } 
        
        else {
            return res.status(400).json({ mensagem: 'Tipo de operação inválido.' });
        }

        // Salvar as alterações na Base de Dados
        await child.save();
        await savings.save();

        return res.status(200).json({ 
            mensagem: 'Sucesso!', 
            novoSaldoCofre: savings.saldo_guardado,
            novoSaldoCarteira: child.pontos
        });

    } catch (error) {
        console.error('Erro na transação:', error);
        return res.status(500).json({ mensagem: 'Erro interno no servidor.' });
    }
};