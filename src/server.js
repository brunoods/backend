const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');           // Segurança
const compression = require('compression'); // Performance
const rateLimit = require('express-rate-limit'); // Proteção contra DDoS/Brute-force
const db = require('./config/db');
const errorMiddleware = require('./middleware/errorMiddleware');

// Importação das rotas
const authRoutes = require('./routes/authRoutes');
const childrenRoutes = require('./routes/childrenRoutes');
const tasksRoutes = require('./routes/tasksRoutes');
const operationsRoutes = require('./routes/operationsRoutes');
const rewardsRoutes = require('./routes/rewardsRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const statsRoutes = require('./routes/statsRoutes');
const milestonesRoutes = require('./routes/milestonesRoutes');
const savingsRoutes = require('./routes/savingsRoutes');
const loansRoutes = require('./routes/loansRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const petsRoutes = require('./routes/petsRoutes');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURAÇÃO DE SEGURANÇA E PERFORMANCE ---

// 1. Helmet: Protege contra vulnerabilidades web comuns (headers HTTP)
app.use(helmet());

// 2. Compression: Comprime as respostas JSON (Gzip) para poupar dados e ser mais rápido
app.use(compression());

// 3. Rate Limiting: Limita o número de requisições por IP
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // Limite de 100 requisições por IP a cada 15 min
    message: 'Muitas requisições criadas a partir deste IP, por favor tente novamente mais tarde.',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// 4. Rate Limit Específico para Login (Mais rigoroso)
const loginLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 10, // Bloqueia após 10 tentativas
    message: 'Muitas tentativas de login. Tente novamente em 1 hora.'
});
app.use('/auth/login', loginLimiter);

// --- MIDDLEWARES PADRÃO ---
app.use(cors());
app.use(express.json());

// Rota de teste (Health Check)
app.get('/', (req, res) => {
    res.json({
        mensagem: 'API do Sistema de Mesada está online! 🚀',
        status: 200,
        uptime: process.uptime(),
        timestamp: new Date()
    });
});

// --- DEFINIÇÃO DAS ROTAS ---
app.use('/auth', authRoutes);
app.use('/children', childrenRoutes);
app.use('/tasks', tasksRoutes);
app.use('/ops', operationsRoutes);
app.use('/rewards', rewardsRoutes);
app.use('/settings', settingsRoutes);
app.use('/stats', statsRoutes);
app.use('/milestones', milestonesRoutes);
app.use('/savings', savingsRoutes);
app.use('/loans', loansRoutes);
app.use('/subscribe', subscriptionRoutes);
app.use('/pets', petsRoutes);

// --- TRATAMENTO DE ERROS CENTRALIZADO ---
// Deve ser sempre o último middleware antes do listen
app.use(errorMiddleware);

// --- INICIALIZAÇÃO DO SERVIDOR ---
const server = app.listen(PORT, () => {
    console.log(`🚀 Servidor BLINDADO rodando na porta ${PORT}`);
});

// --- GRACEFUL SHUTDOWN (Desligamento Gracioso) ---
// Garante que o banco fecha corretamente se o servidor reiniciar
const gracefulShutdown = () => {
    console.log('🛑 Recebido sinal de encerramento. Fechando servidor...');
    
    server.close(async () => {
        console.log('🔌 Servidor HTTP fechado.');
        
        try {
            await db.end(); // Fecha conexão com MySQL
            console.log('💾 Conexão com Banco de Dados encerrada com sucesso.');
            process.exit(0);
        } catch (err) {
            console.error('❌ Erro ao fechar banco de dados:', err);
            process.exit(1);
        }
    });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);