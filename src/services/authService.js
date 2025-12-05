const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.registerUser = async ({ nome, email, senha }) => {
    const [existing] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) throw new Error('Este email já está cadastrado.');

    const salt = await bcrypt.genSalt(10);
    const senhaHash = await bcrypt.hash(senha, salt);

    const [result] = await db.execute(
        'INSERT INTO users (nome, email, senha_hash) VALUES (?, ?, ?)',
        [nome, email, senhaHash]
    );
    return result.insertId;
};

exports.authenticateUser = async ({ email, senha }) => {
    const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) throw new Error('Email ou senha incorretos.');

    const user = users[0];
    const isMatch = await bcrypt.compare(senha, user.senha_hash);
    if (!isMatch) throw new Error('Email ou senha incorretos.');

    const effectiveId = user.admin_id ? user.admin_id : user.id;
    const token = jwt.sign(
        { id: effectiveId, nome: user.nome, real_id: user.id },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
    );

    return {
        token,
        usuario: {
            id: effectiveId,
            nome: user.nome,
            email: user.email,
            is_pro: !!user.is_pro || !!user.admin_id 
        }
    };
};

exports.requestLink = async (requesterId, emailAdmin) => {
    // Achar o pai pelo email
    const [admins] = await db.execute('SELECT id, nome FROM users WHERE email = ?', [emailAdmin]);
    if (admins.length === 0) throw new Error('E-mail não encontrado.');

    const adminId = admins[0].id;
    if (adminId === requesterId) throw new Error('Você não pode vincular a si mesmo.');

    // Verificar se já existe pedido
    const [pedidos] = await db.execute(
        'SELECT id FROM family_requests WHERE requester_id = ? AND admin_id = ?',
        [requesterId, adminId]
    );
    if (pedidos.length > 0) throw new Error('Já existe uma solicitação pendente para este usuário.');

    await db.execute(
        'INSERT INTO family_requests (requester_id, admin_id) VALUES (?, ?)',
        [requesterId, adminId]
    );
    
    return admins[0].nome;
};

exports.listRequests = async (adminId) => {
    const [solicitacoes] = await db.execute(`
        SELECT r.id, u.nome, u.email 
        FROM family_requests r
        JOIN users u ON r.requester_id = u.id
        WHERE r.admin_id = ?
    `, [adminId]);
    return solicitacoes;
};

exports.respondLink = async (adminId, { requestId, acao }) => {
    // Buscar o pedido para garantir que pertence a este admin
    const [pedidos] = await db.execute('SELECT * FROM family_requests WHERE id = ? AND admin_id = ?', [requestId, adminId]);
    if (pedidos.length === 0) throw new Error('Solicitação não encontrada ou não autorizada.');

    const pedido = pedidos[0];

    if (acao === 'aprovar') {
        // Efetiva o vínculo
        await db.execute('UPDATE users SET admin_id = ? WHERE id = ?', [adminId, pedido.requester_id]);
    }

    // Limpa o pedido
    await db.execute('DELETE FROM family_requests WHERE id = ?', [requestId]);
};

exports.updateProfile = async (userId, { nome, email }) => {
    // Verifica se o email já está em uso por outra pessoa
    const [users] = await db.execute(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, userId]
    );
    if (users.length > 0) throw new Error('Este email já está em uso.');

    await db.execute(
        'UPDATE users SET nome = ?, email = ? WHERE id = ?',
        [nome, email, userId]
    );
};

exports.changePassword = async (userId, { senhaAtual, novaSenha }) => {
    const [users] = await db.execute('SELECT senha_hash FROM users WHERE id = ?', [userId]);
    const user = users[0];

    const senhaValida = await bcrypt.compare(senhaAtual, user.senha_hash);
    if (!senhaValida) throw new Error('A senha atual está incorreta.');

    const salt = await bcrypt.genSalt(10);
    const novaHash = await bcrypt.hash(novaSenha, salt);

    await db.execute('UPDATE users SET senha_hash = ? WHERE id = ?', [novaHash, userId]);
};