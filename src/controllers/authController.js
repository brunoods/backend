const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');

// 1. Registrar Pai/Mãe
exports.registrarPai = asyncHandler(async (req, res) => {
    const { nome, email, senha } = req.body;

    if (!nome || !email || !senha) {
        const error = new Error('Por favor, preencha todos os campos: nome, email e senha.');
        error.statusCode = 400;
        throw error;
    }

    const [usuariosExistentes] = await db.execute(
        'SELECT * FROM users WHERE email = ?', 
        [email]
    );

    if (usuariosExistentes.length > 0) {
        const error = new Error('Este email já está cadastrado.');
        error.statusCode = 409;
        throw error;
    }

    const salt = await bcrypt.genSalt(10);
    const senhaHash = await bcrypt.hash(senha, salt);

    const [resultado] = await db.execute(
        'INSERT INTO users (nome, email, senha_hash) VALUES (?, ?, ?)',
        [nome, email, senhaHash]
    );

    res.status(201).json({
        mensagem: 'Usuário cadastrado com sucesso!',
        usuarioId: resultado.insertId
    });
});

// 2. Login
exports.login = asyncHandler(async (req, res) => {
    const { email, senha } = req.body;

    const [usuarios] = await db.execute(
        'SELECT * FROM users WHERE email = ?',
        [email]
    );

    if (usuarios.length === 0) {
        const error = new Error('Email ou senha incorretos.');
        error.statusCode = 401;
        throw error;
    }

    const usuario = usuarios[0];
    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);

    if (!senhaValida) {
        const error = new Error('Email ou senha incorretos.');
        error.statusCode = 401;
        throw error;
    }

    const effectiveId = usuario.admin_id ? usuario.admin_id : usuario.id;

    const token = jwt.sign(
        { id: effectiveId, nome: usuario.nome, real_id: usuario.id },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
    );

    res.json({
        mensagem: 'Login realizado com sucesso!',
        token: token,
        usuario: {
            id: effectiveId,
            nome: usuario.nome,
            email: usuario.email
        }
    });
});

// 3. Solicitar Vínculo
exports.solicitarVinculo = asyncHandler(async (req, res) => {
    const meuIdReal = req.user.real_id || req.user.id;
    const { emailAdmin } = req.body;

    const [admins] = await db.execute('SELECT id, nome FROM users WHERE email = ?', [emailAdmin]);
    
    if (admins.length === 0) {
        const error = new Error('E-mail não encontrado.');
        error.statusCode = 404;
        throw error;
    }

    const adminId = admins[0].id;

    if (adminId === meuIdReal) {
        const error = new Error('Você não pode vincular a si mesmo.');
        error.statusCode = 400;
        throw error;
    }

    const [pedidos] = await db.execute(
        'SELECT * FROM family_requests WHERE requester_id = ? AND admin_id = ?',
        [meuIdReal, adminId]
    );

    if (pedidos.length > 0) {
        const error = new Error('Já existe uma solicitação pendente para este usuário.');
        error.statusCode = 409;
        throw error;
    }

    await db.execute(
        'INSERT INTO family_requests (requester_id, admin_id) VALUES (?, ?)',
        [meuIdReal, adminId]
    );

    res.json({ mensagem: `Solicitação enviada para ${admins[0].nome}. Aguarde a aprovação.` });
});

// 4. Listar Solicitações
exports.listarSolicitacoes = asyncHandler(async (req, res) => {
    const meuId = req.user.id; 

    const [solicitacoes] = await db.execute(`
        SELECT r.id, u.nome, u.email 
        FROM family_requests r
        JOIN users u ON r.requester_id = u.id
        WHERE r.admin_id = ?
    `, [meuId]);

    res.json(solicitacoes);
});

// 5. Responder Solicitação
exports.responderVinculo = asyncHandler(async (req, res) => {
    const meuId = req.user.id;
    const { requestId, acao } = req.body;

    const [pedidos] = await db.execute('SELECT * FROM family_requests WHERE id = ? AND admin_id = ?', [requestId, meuId]);
    
    if (pedidos.length === 0) {
        const error = new Error('Solicitação não encontrada.');
        error.statusCode = 404;
        throw error;
    }

    const pedido = pedidos[0];

    if (acao === 'aprovar') {
        await db.execute('UPDATE users SET admin_id = ? WHERE id = ?', [meuId, pedido.requester_id]);
    }

    await db.execute('DELETE FROM family_requests WHERE id = ?', [requestId]);

    res.json({ mensagem: acao === 'aprovar' ? 'Vínculo aprovado com sucesso!' : 'Solicitação rejeitada.' });
});

// 6. Editar Perfil
exports.editarPerfil = asyncHandler(async (req, res) => {
    const userId = req.user.real_id || req.user.id;
    const { nome, email } = req.body;

    if (!nome || !email) {
        const error = new Error('Nome e email são obrigatórios.');
        error.statusCode = 400;
        throw error;
    }

    const [users] = await db.execute(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, userId]
    );

    if (users.length > 0) {
        const error = new Error('Este email já está em uso.');
        error.statusCode = 409;
        throw error;
    }

    await db.execute(
        'UPDATE users SET nome = ?, email = ? WHERE id = ?',
        [nome, email, userId]
    );

    res.json({ mensagem: 'Perfil atualizado com sucesso!' });
});

// 7. Alterar Senha
exports.alterarSenha = asyncHandler(async (req, res) => {
    const userId = req.user.real_id || req.user.id;
    const { senhaAtual, novaSenha } = req.body;

    if (!senhaAtual || !novaSenha) {
        const error = new Error('Preencha as senhas.');
        error.statusCode = 400;
        throw error;
    }

    const [users] = await db.execute('SELECT senha_hash FROM users WHERE id = ?', [userId]);
    const user = users[0];

    const senhaValida = await bcrypt.compare(senhaAtual, user.senha_hash);
    if (!senhaValida) {
        const error = new Error('A senha atual está incorreta.');
        error.statusCode = 401;
        throw error;
    }

    const salt = await bcrypt.genSalt(10);
    const novaHash = await bcrypt.hash(novaSenha, salt);

    await db.execute(
        'UPDATE users SET senha_hash = ? WHERE id = ?',
        [novaHash, userId]
    );

    res.json({ mensagem: 'Senha alterada com sucesso!' });
});