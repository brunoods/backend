const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

// Configura o cliente do Google com o ID do ambiente (Best Practice)
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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

// --- LOGIN COM GOOGLE (VERSÃO BLINDADA 🛡️) ---
exports.loginWithGoogle = async (googleToken) => {
    try {
        // 1. Validação de Segurança do Google
        const ticket = await googleClient.verifyIdToken({
            idToken: googleToken,
            audience: process.env.GOOGLE_CLIENT_ID // Bloqueia tokens gerados para outros apps
        });
        
        const payload = ticket.getPayload();
        // Extraímos dados seguros (picture é a foto do perfil Google)
        const { email, name, picture } = payload; 

        // 2. Verificar base de dados
        const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
        
        let user;

        if (users.length > 0) {
            // --- CENÁRIO A: Usuário já existe ---
            user = users[0];
        } else {
            // --- CENÁRIO B: Usuário Novo (Auto-Cadastro) ---
            const randomPassword = Math.random().toString(36).slice(-8) + Date.now().toString();
            const salt = await bcrypt.genSalt(10);
            const senhaHash = await bcrypt.hash(randomPassword, salt);

            const [result] = await db.execute(
                'INSERT INTO users (nome, email, senha_hash) VALUES (?, ?, ?)',
                [name, email, senhaHash]
            );
            
            user = { 
                id: result.insertId, 
                nome: name, 
                email: email, 
                admin_id: null, 
                is_pro: 0,
                // Se quiseres salvar a foto no futuro, adiciona a coluna 'avatar' na tabela users
                avatar: picture 
            };
        }

        // 3. Gerar Token JWT
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
                // Envia a foto do Google para o app usar, mesmo que não esteja salva no banco
                avatar: user.avatar || picture, 
                is_pro: !!user.is_pro || !!user.admin_id 
            }
        };

    } catch (error) {
        console.error('Erro Auth Google:', error.message);
        throw new Error('Falha na autenticação com Google. Tente novamente.');
    }
};

// --- FUNÇÕES DE VÍNCULO FAMILIAR ---

exports.requestLink = async (requesterId, emailAdmin) => {
    const [admins] = await db.execute('SELECT id, nome FROM users WHERE email = ?', [emailAdmin]);
    if (admins.length === 0) throw new Error('E-mail não encontrado.');

    const adminId = admins[0].id;
    if (adminId === requesterId) throw new Error('Você não pode vincular a si mesmo.');

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
    const [pedidos] = await db.execute('SELECT * FROM family_requests WHERE id = ? AND admin_id = ?', [requestId, adminId]);
    if (pedidos.length === 0) throw new Error('Solicitação não encontrada ou não autorizada.');

    const pedido = pedidos[0];

    if (acao === 'aprovar') {
        await db.execute('UPDATE users SET admin_id = ? WHERE id = ?', [adminId, pedido.requester_id]);
    }

    await db.execute('DELETE FROM family_requests WHERE id = ?', [requestId]);
};

// --- FUNÇÕES DE PERFIL ---

exports.updateProfile = async (userId, { nome, email }) => {
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