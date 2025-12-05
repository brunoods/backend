const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// Criar tarefa
exports.criarTarefa = asyncHandler(async (req, res) => {
    const parentId = req.user.id;
    const { nome, pontos, frequencia, targetChildId, deadline } = req.body;

    if (!nome || !pontos) {
        const error = new Error('Nome e pontos são obrigatórios.');
        error.statusCode = 400;
        throw error;
    }

    const [resultado] = await db.execute(
        'INSERT INTO tasks (parent_id, nome, pontos, frequencia, target_child_id, deadline) VALUES (?, ?, ?, ?, ?, ?)',
        [parentId, nome, pontos, frequencia || 'livre', targetChildId || null, deadline || null]
    );

    res.status(201).json({
        mensagem: 'Tarefa criada com sucesso!',
        id: resultado.insertId
    });
});

// Listar tarefas
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
        const error = new Error('Tarefa não encontrada.');
        error.statusCode = 404;
        throw error;
    }

    res.json({ mensagem: 'Tarefa removida com sucesso.' });
});

// Editar Tarefa
exports.editarTarefa = asyncHandler(async (req, res) => {
    const parentId = req.user.id;
    const { id } = req.params;
    const { nome, pontos, frequencia, targetChildId, deadline } = req.body;

    if (!nome || !pontos) {
        const error = new Error('Nome e pontos são obrigatórios.');
        error.statusCode = 400;
        throw error;
    }

    const [result] = await db.execute(
        'UPDATE tasks SET nome = ?, pontos = ?, frequencia = ?, target_child_id = ?, deadline = ? WHERE id = ? AND parent_id = ?',
        [nome, pontos, frequencia || 'livre', targetChildId || null, deadline || null, id, parentId]
    );

    if (result.affectedRows === 0) {
        const error = new Error('Tarefa não encontrada ou não autorizada.');
        error.statusCode = 404;
        throw error;
    }

    res.json({ mensagem: 'Tarefa atualizada com sucesso!' });
});