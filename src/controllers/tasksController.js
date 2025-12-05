const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const taskSchema = require('../schemas/taskSchema'); // Certifica-te que criaste este arquivo

// Criar nova tarefa
exports.criarTarefa = asyncHandler(async (req, res) => {
    const parentId = req.user.id;

    // 1. Validação Automática com Zod
    // Se os dados estiverem errados, o Zod lança um erro e o errorMiddleware captura.
    const dadosValidados = taskSchema.parse(req.body);
    
    const { nome, pontos, frequencia, targetChildId, deadline } = dadosValidados;

    // 2. Inserção no Banco
    const [resultado] = await db.execute(
        'INSERT INTO tasks (parent_id, nome, pontos, frequencia, target_child_id, deadline) VALUES (?, ?, ?, ?, ?, ?)',
        [parentId, nome, pontos, frequencia, targetChildId || null, deadline || null]
    );

    res.status(201).json({
        mensagem: 'Tarefa criada com sucesso!',
        id: resultado.insertId
    });
});

// Listar tarefas (filtrando por filho se necessário)
exports.listarTarefas = asyncHandler(async (req, res) => {
    const parentId = req.user.id;
    const { childId } = req.query; 

    let query = 'SELECT * FROM tasks WHERE parent_id = ?';
    let params = [parentId];

    if (childId) {
        query += ' AND (target_child_id = ? OR target_child_id IS NULL)';
        params.push(childId);
    }
    
    query += ' ORDER BY deadline ASC';

    const [tarefas] = await db.execute(query, params);
    res.json(tarefas);
});

// Deletar Tarefa
exports.deletarTarefa = asyncHandler(async (req, res) => {
    const parentId = req.user.id;
    const { id } = req.params;

    const [resultado] = await db.execute(
        'DELETE FROM tasks WHERE id = ? AND parent_id = ?',
        [id, parentId]
    );

    if (resultado.affectedRows === 0) {
        const erro = new Error('Tarefa não encontrada ou não pertence a este pai.');
        erro.statusCode = 404;
        throw erro;
    }

    res.json({ mensagem: 'Tarefa removida com sucesso.' });
});

// Editar Tarefa
exports.editarTarefa = asyncHandler(async (req, res) => {
    const parentId = req.user.id;
    const { id } = req.params;

    // 1. Validação com Zod
    const dadosValidados = taskSchema.parse(req.body);
    const { nome, pontos, frequencia, targetChildId, deadline } = dadosValidados;

    // 2. Atualização
    const [result] = await db.execute(
        'UPDATE tasks SET nome = ?, pontos = ?, frequencia = ?, target_child_id = ?, deadline = ? WHERE id = ? AND parent_id = ?',
        [nome, pontos, frequencia, targetChildId || null, deadline || null, id, parentId]
    );

    if (result.affectedRows === 0) {
        const erro = new Error('Tarefa não encontrada ou não autorizada.');
        erro.statusCode = 404;
        throw erro;
    }

    res.json({ mensagem: 'Tarefa atualizada com sucesso!' });
});