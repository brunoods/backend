module.exports = (err, req, res, next) => {
    console.error(`❌ Erro: ${err.message}`);
    
    // Se o erro tiver um status code definido (ex: 404), usa ele. Se não, 500.
    const statusCode = err.statusCode || 500;
    
    // Mantemos a chave "mensagem" para não quebrar o Frontend que espera isso
    res.status(statusCode).json({
        mensagem: statusCode === 500 ? 'Erro interno no servidor.' : err.message,
        error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
};