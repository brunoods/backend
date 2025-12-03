const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    // 1. Buscar o token no cabeçalho da requisição (Header: Authorization)
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ mensagem: 'Acesso negado. Token não fornecido.' });
    }

    // O formato geralmente é "Bearer TOKEN_AQUI", então separamos para pegar só o token
    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ mensagem: 'Token inválido.' });
    }

    try {
        // 2. Verificar se o token é válido usando nossa chave secreta
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 3. Adicionar os dados do usuário na requisição para as próximas etapas usarem
        req.user = decoded;

        // 4. Passar para a próxima etapa (o controller)
        next();

    } catch (error) {
        return res.status(403).json({ mensagem: 'Token inválido ou expirado.' });
    }
};