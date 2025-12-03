const db = require('../config/db');

// Criar nova tarefa (com suporte a filho específico e prazo)
exports.criarTarefa = async (req, res) => {
    try {
        const parentId = req.user.id;
        const { nome, pontos, frequencia, targetChildId, deadline } = req.body;

        if (!nome || !pontos) {
            return res.status(400).json({ mensagem: 'Nome e pontos são obrigatórios.' });
        }

        const [resultado] = await db.execute(
            'INSERT INTO tasks (parent_id, nome, pontos, frequencia, target_child_id, deadline) VALUES (?, ?, ?, ?, ?, ?)',
            [parentId, nome, pontos, frequencia || 'livre', targetChildId || null, deadline || null]
        );

        res.status(201).json({
            mensagem: 'Tarefa criada com sucesso!',
            id: resultado.insertId
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensagem: 'Erro ao criar tarefa.' });
    }
};

// Listar tarefas (filtrando por filho se necessário)
exports.listarTarefas = async (req, res) => {
    try {
        const parentId = req.user.id;
        const { childId } = req.query; // Podemos passar ?childId=1 na URL para filtrar

        let query = 'SELECT * FROM tasks WHERE parent_id = ?';
        let params = [parentId];

        // Se passar um filho, traz as tarefas dele + as tarefas "para todos" (null)
        // Se não passar filho, traz tudo do pai
        if (childId) {
            query += ' AND (target_child_id = ? OR target_child_id IS NULL)';
            params.push(childId);
        }
        
        // Ordena por prazo (mais urgentes primeiro)
        query += ' ORDER BY deadline ASC';

        const [tarefas] = await db.execute(query, params);
        res.json(tarefas);
    } catch (error) {
        res.status(500).json({ mensagem: 'Erro ao listar tarefas.' });
    }
};

// Deletar Tarefa
exports.deletarTarefa = async (req, res) => {
    try {
        const parentId = req.user.id;
        const { id } = req.params;

        const [resultado] = await db.execute(
            'DELETE FROM tasks WHERE id = ? AND parent_id = ?',
            [id, parentId]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ mensagem: 'Tarefa não encontrada.' });
        }

        res.json({ mensagem: 'Tarefa removida com sucesso.' });
    } catch (error) {
        res.status(500).json({ mensagem: 'Erro ao remover tarefa.' });
    }
};

// Editar Tarefa (NOVO)
exports.editarTarefa = async (req, res) => {
    try {
        const parentId = req.user.id;
        const { id } = req.params;
        const { nome, pontos, frequencia, targetChildId, deadline } = req.body;

        if (!nome || !pontos) {
            return res.status(400).json({ mensagem: 'Nome e pontos são obrigatórios.' });
        }

        const [result] = await db.execute(
            'UPDATE tasks SET nome = ?, pontos = ?, frequencia = ?, target_child_id = ?, deadline = ? WHERE id = ? AND parent_id = ?',
            [nome, pontos, frequencia || 'livre', targetChildId || null, deadline || null, id, parentId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ mensagem: 'Tarefa não encontrada ou não autorizada.' });
        }

        res.json({ mensagem: 'Tarefa atualizada com sucesso!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensagem: 'Erro ao atualizar tarefa.' });
    }
};