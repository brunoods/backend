const tasksService = require('../services/tasksService');
const asyncHandler = require('../utils/asyncHandler');
const taskSchema = require('../schemas/taskSchema');

exports.criarTarefa = asyncHandler(async (req, res) => {
    const data = taskSchema.parse(req.body);
    const id = await tasksService.create(req.user.id, data);
    res.status(201).json({ mensagem: 'Tarefa criada com sucesso!', id });
});

exports.listarTarefas = asyncHandler(async (req, res) => {
    // Passamos req.query.concluida para o serviço
    const tarefas = await tasksService.list(req.user.id, req.query.childId, req.query.concluida);
    res.json(tarefas);
});

exports.editarTarefa = asyncHandler(async (req, res) => {
    const data = taskSchema.parse(req.body);
    await tasksService.update(req.user.id, req.params.id, data);
    res.json({ mensagem: 'Tarefa atualizada com sucesso!' });
});

exports.deletarTarefa = asyncHandler(async (req, res) => {
    await tasksService.delete(req.user.id, req.params.id);
    res.json({ mensagem: 'Tarefa removida com sucesso.' });
});