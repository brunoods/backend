const childrenService = require('../services/childrenService');
const asyncHandler = require('../utils/asyncHandler');

exports.listarFilhos = asyncHandler(async (req, res) => {
    const filhos = await childrenService.listByParent(req.user.id);
    res.json(filhos);
});

exports.criarFilho = asyncHandler(async (req, res) => {
    if (!req.body.nome) {
        const erro = new Error('O nome da criança é obrigatório.');
        erro.statusCode = 400;
        throw erro;
    }
    
    const child = await childrenService.create(req.user.id, req.body);
    res.status(201).json({ mensagem: 'Criança cadastrada com sucesso!', ...child });
});

exports.editarFilho = asyncHandler(async (req, res) => {
    if (!req.body.nome) {
        const erro = new Error('Nome é obrigatório.');
        erro.statusCode = 400;
        throw erro;
    }

    await childrenService.update(req.user.id, req.params.id, req.body);
    res.json({ mensagem: 'Dados atualizados com sucesso.' });
});

exports.deletarFilho = asyncHandler(async (req, res) => {
    await childrenService.delete(req.user.id, req.params.id);
    res.json({ mensagem: 'Criança removida com sucesso.' });
});