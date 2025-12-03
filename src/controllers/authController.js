const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// 1. Registrar Pai/Mãe
exports.registrarPai = async (req, res) => {
    try {
        const { nome, email, senha } = req.body;

        if (!nome || !email || !senha) {
            return res.status(400).json({ 
                mensagem: 'Por favor, preencha todos os campos: nome, email e senha.' 
            });
        }

        const [usuariosExistentes] = await db.execute(
            'SELECT * FROM users WHERE email = ?', 
            [email]
        );

        if (usuariosExistentes.length > 0) {
            return res.status(409).json({ 
                mensagem: 'Este email já está cadastrado.' 
            });
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

    } catch (error) {
        console.error('Erro no registro:', error);
        res.status(500).json({ 
            mensagem: 'Erro interno no servidor ao registrar usuário.' 
        });
    }
};

// 2. Login (Com lógica de Admin/Vínculo)
exports.login = async (req, res) => {
    try {
        const { email, senha } = req.body;

        const [usuarios] = await db.execute(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (usuarios.length === 0) {
            return res.status(401).json({ mensagem: 'Email ou senha incorretos.' });
        }

        const usuario = usuarios[0];
        const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);

        if (!senhaValida) {
            return res.status(401).json({ mensagem: 'Email ou senha incorretos.' });
        }

        // LÓGICA DO VÍNCULO: Se tiver admin_id, usa ele. Se não, usa o próprio ID.
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

    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ mensagem: 'Erro interno no servidor ao fazer login.' });
    }
};

// 3. Solicitar Vínculo (Novo)
exports.solicitarVinculo = async (req, res) => {
    try {
        const meuIdReal = req.user.real_id || req.user.id;
        const { emailAdmin } = req.body;

        // Achar o pai pelo email
        const [admins] = await db.execute('SELECT id, nome FROM users WHERE email = ?', [emailAdmin]);
        
        if (admins.length === 0) {
            return res.status(404).json({ mensagem: 'E-mail não encontrado.' });
        }

        const adminId = admins[0].id;

        if (adminId === meuIdReal) {
            return res.status(400).json({ mensagem: 'Você não pode vincular a si mesmo.' });
        }

        // Verificar se já existe pedido pendente
        const [pedidos] = await db.execute(
            'SELECT * FROM family_requests WHERE requester_id = ? AND admin_id = ?',
            [meuIdReal, adminId]
        );

        if (pedidos.length > 0) {
            return res.status(409).json({ mensagem: 'Já existe uma solicitação pendente para este usuário.' });
        }

        // Criar o pedido
        await db.execute(
            'INSERT INTO family_requests (requester_id, admin_id) VALUES (?, ?)',
            [meuIdReal, adminId]
        );

        res.json({ mensagem: `Solicitação enviada para ${admins[0].nome}. Aguarde a aprovação.` });

    } catch (error) {
        console.error(error);
        res.status(500).json({ mensagem: 'Erro ao solicitar vínculo.' });
    }
};

// 4. Listar Solicitações Pendentes (Novo)
exports.listarSolicitacoes = async (req, res) => {
    try {
        const meuId = req.user.id; 

        const [solicitacoes] = await db.execute(`
            SELECT r.id, u.nome, u.email 
            FROM family_requests r
            JOIN users u ON r.requester_id = u.id
            WHERE r.admin_id = ?
        `, [meuId]);

        res.json(solicitacoes);
    } catch (error) {
        res.status(500).json({ mensagem: 'Erro ao buscar solicitações.' });
    }
};

// 5. Responder Solicitação (Aprovar/Rejeitar) (Novo)
exports.responderVinculo = async (req, res) => {
    try {
        const meuId = req.user.id;
        const { requestId, acao } = req.body; // acao: 'aprovar' ou 'rejeitar'

        // Buscar o pedido
        const [pedidos] = await db.execute('SELECT * FROM family_requests WHERE id = ? AND admin_id = ?', [requestId, meuId]);
        
        if (pedidos.length === 0) {
            return res.status(404).json({ mensagem: 'Solicitação não encontrada.' });
        }

        const pedido = pedidos[0];

        if (acao === 'aprovar') {
            // Efetiva o vínculo: O solicitante passa a ter o admin_id = meuId
            await db.execute('UPDATE users SET admin_id = ? WHERE id = ?', [meuId, pedido.requester_id]);
        }

        // Remove o pedido da tabela (limpeza)
        await db.execute('DELETE FROM family_requests WHERE id = ?', [requestId]);

        res.json({ mensagem: acao === 'aprovar' ? 'Vínculo aprovado com sucesso!' : 'Solicitação rejeitada.' });

    } catch (error) {
        res.status(500).json({ mensagem: 'Erro ao responder solicitação.' });
    }
    
};

// 6. Editar Perfil (Nome e Email)
exports.editarPerfil = async (req, res) => {
    try {
        // Garante que altera o usuário logado, não o admin vinculado
        const userId = req.user.real_id || req.user.id;
        const { nome, email } = req.body;

        if (!nome || !email) {
            return res.status(400).json({ mensagem: 'Nome e email são obrigatórios.' });
        }

        // Verifica se o email já está sendo usado por OUTRA pessoa
        const [users] = await db.execute(
            'SELECT id FROM users WHERE email = ? AND id != ?',
            [email, userId]
        );

        if (users.length > 0) {
            return res.status(409).json({ mensagem: 'Este email já está em uso.' });
        }

        await db.execute(
            'UPDATE users SET nome = ?, email = ? WHERE id = ?',
            [nome, email, userId]
        );

        res.json({ mensagem: 'Perfil atualizado com sucesso!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensagem: 'Erro ao atualizar perfil.' });
    }
};

// 7. Alterar Senha
exports.alterarSenha = async (req, res) => {
    try {
        const userId = req.user.real_id || req.user.id;
        const { senhaAtual, novaSenha } = req.body;

        if (!senhaAtual || !novaSenha) {
            return res.status(400).json({ mensagem: 'Preencha as senhas.' });
        }

        // Busca a senha atual para conferir
        const [users] = await db.execute('SELECT senha_hash FROM users WHERE id = ?', [userId]);
        const user = users[0];

        const senhaValida = await bcrypt.compare(senhaAtual, user.senha_hash);
        if (!senhaValida) {
            return res.status(401).json({ mensagem: 'A senha atual está incorreta.' });
        }

        // Criptografa a nova senha
        const salt = await bcrypt.genSalt(10);
        const novaHash = await bcrypt.hash(novaSenha, salt);

        await db.execute(
            'UPDATE users SET senha_hash = ? WHERE id = ?',
            [novaHash, userId]
        );

        res.json({ mensagem: 'Senha alterada com sucesso!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensagem: 'Erro ao alterar senha.' });
    }
};