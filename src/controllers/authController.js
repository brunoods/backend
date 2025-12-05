const authService = require('../services/authService');
const asyncHandler = require('../utils/asyncHandler');
const { 
    registerSchema, 
    loginSchema, 
    linkRequestSchema, 
    linkResponseSchema, 
    updateProfileSchema, 
    changePasswordSchema 
} = require('../schemas/authSchema');

exports.registrarPai = asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body);
    const userId = await authService.registerUser(data);
    res.status(201).json({ mensagem: 'Usuário cadastrado com sucesso!', usuarioId: userId });
});

exports.login = asyncHandler(async (req, res) => {
    const data = loginSchema.parse(req.body);
    const result = await authService.authenticateUser(data);
    res.json({ mensagem: 'Login realizado com sucesso!', ...result });
});

exports.solicitarVinculo = asyncHandler(async (req, res) => {
    const meuIdReal = req.user.real_id || req.user.id;
    const { emailAdmin } = linkRequestSchema.parse(req.body);
    
    const adminNome = await authService.requestLink(meuIdReal, emailAdmin);
    res.json({ mensagem: `Solicitação enviada para ${adminNome}. Aguarde a aprovação.` });
});

exports.listarSolicitacoes = asyncHandler(async (req, res) => {
    const solicitacoes = await authService.listRequests(req.user.id);
    res.json(solicitacoes);
});

exports.responderVinculo = asyncHandler(async (req, res) => {
    const data = linkResponseSchema.parse(req.body);
    await authService.respondLink(req.user.id, data);
    res.json({ mensagem: data.acao === 'aprovar' ? 'Vínculo aprovado com sucesso!' : 'Solicitação rejeitada.' });
});

exports.editarPerfil = asyncHandler(async (req, res) => {
    const userId = req.user.real_id || req.user.id;
    const data = updateProfileSchema.parse(req.body);
    
    await authService.updateProfile(userId, data);
    res.json({ mensagem: 'Perfil atualizado com sucesso!' });
});

exports.alterarSenha = asyncHandler(async (req, res) => {
    const userId = req.user.real_id || req.user.id;
    const data = changePasswordSchema.parse(req.body);
    
    await authService.changePassword(userId, data);
    res.json({ mensagem: 'Senha alterada com sucesso!' });
});