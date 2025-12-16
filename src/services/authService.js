const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Verifica se o fetch existe (Node 18+). Se não, tenta importar node-fetch.
// Se estiveres a usar Node antigo e der erro, instala: npm install node-fetch
const fetch = global.fetch || require('node-fetch');

// --- 1. REGISTO NORMAL (CRIAR CONTA) ---
exports.registerUser = async ({ nome, email, senha }) => {
    // Verificar se o utilizador já existe
    const [existing] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
        throw new Error('Este email já está cadastrado.');
    }

    // Criar Hash da Senha
    const salt = await bcrypt.genSalt(10);
    const senhaHash = await bcrypt.hash(senha, salt);

    // Inserir na Base de Dados
    // Nota: Garante que as colunas da tua tabela correspondem a estas
    const [result] = await db.execute(
        'INSERT INTO users (nome, email, senha_hash) VALUES (?, ?, ?)',
        [nome, email, senhaHash]
    );

    return result.insertId;
};

// --- 2. LOGIN NORMAL (E-MAIL E SENHA) ---
exports.authenticateUser = async ({ email, senha }) => {
    console.log(`[Auth] Tentativa de login para: ${email}`);

    // Buscar utilizador
    const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);

    if (users.length === 0) {
        console.log('[Auth] Erro: Email não encontrado.');
        throw new Error('Email ou senha incorretos.');
    }

    const user = users[0];

    // Verificar se a senha na BD é um hash (começa por $2a$...)
    // Se tiveres senhas em texto plano (ex: "123456") de testes antigos, elas vão falhar aqui.
    const isMatch = await bcrypt.compare(senha, user.senha_hash);

    if (!isMatch) {
        console.log('[Auth] Erro: Senha incorreta.');
        throw new Error('Email ou senha incorretos.');
    }

    // Gerar Token JWT
    const effectiveId = user.admin_id ? user.admin_id : user.id;
    const token = jwt.sign(
        { id: effectiveId, nome: user.nome, real_id: user.id },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
    );

    console.log('[Auth] Sucesso: Token gerado.');

    return {
        token,
        usuario: {
            id: effectiveId,
            nome: user.nome,
            email: user.email,
            avatar: user.avatar || null,
            is_pro: !!user.is_pro || !!user.admin_id 
        }
    };
};

// --- 3. LOGIN COM GOOGLE (Validação de ID TOKEN) ---
exports.loginWithGoogle = async (idToken) => {
    try {
        console.log('[Auth Google] Validando token...');

        // Validar token diretamente com o Google
        const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('[Auth Google] Erro na validação:', errorData);
            throw new Error('Token Google inválido ou expirado.');
        }

        const payload = await response.json();
        const { email, name, picture, sub: googleId } = payload;

        // Verificar se já existe na BD
        const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
        
        let user;

        if (users.length > 0) {
            // Utilizador Existente
            user = users[0];
            console.log(`[Auth Google] Login de utilizador existente: ${email}`);
        } else {
            // Novo Utilizador (Registo Automático)
            console.log(`[Auth Google] Criando novo utilizador: ${email}`);
            
            const randomPassword = Math.random().toString(36).slice(-8) + Date.now().toString();
            const salt = await bcrypt.genSalt(10);
            const senhaHash = await bcrypt.hash(randomPassword, salt);

            // Adapta as colunas conforme a tua tabela real
            const [result] = await db.execute(
                'INSERT INTO users (nome, email, senha_hash, avatar, is_pro) VALUES (?, ?, ?, ?, 0)',
                [name, email, senhaHash, picture || null]
            );
            
            user = { 
                id: result.insertId, 
                nome: name, 
                email: email, 
                admin_id: null, 
                is_pro: 0,
                avatar: picture 
            };
        }

        // Gerar JWT da App
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
                avatar: user.avatar || picture,
                is_pro: !!user.is_pro || !!user.admin_id 
            }
        };

    } catch (error) {
        console.error('[Auth Google] Falha:', error.message);
        throw new Error('Falha na autenticação com Google.');
    }
};

// --- 4. FUNÇÕES DE VÍNCULO FAMILIAR ---
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

// --- 5. FUNÇÕES DE PERFIL ---
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