const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const db = require('./config/db');
const errorMiddleware = require('./middleware/errorMiddleware');
const morgan = require('morgan');

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
const startCron = require('./cron/dailyReset');

// --- ROTAS NOVAS (Loja e Quarto) ---
const shopRoutes = require('./routes/shopRoutes');
const contentRoutes = require('./routes/contentRoutes');
const roomRoutes = require('./routes/roomRoutes'); // <--- ADICIONADO AQUI
// -----------------------------------

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

// --- SEGURANÇA E PERFORMANCE ---
app.use(helmet());
app.use(compression());

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Muitas requisições, tente novamente mais tarde.',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

const loginLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: 'Muitas tentativas de login. Tente novamente em 1 hora.'
});
app.use('/auth/login', loginLimiter);

app.use(morgan('dev'));

// --- MIDDLEWARES PADRÃO ---
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ mensagem: 'API do Sistema de Mesada está online! 🚀', status: 200, uptime: process.uptime() });
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

// --- ROTAS NOVAS REGISTADAS ---
app.use('/shop', shopRoutes);
app.use('/content', contentRoutes);
app.use('/room', roomRoutes); // <--- A LINHA QUE FALTAVA PARA CORRIGIR O 404
// ------------------------------

app.use(errorMiddleware);

const server = app.listen(PORT, () => {
    console.log(`🚀 Servidor BLINDADO rodando na porta ${PORT}`);
    startCron(); // <--- ATIVAR AQUI
});

const gracefulShutdown = () => {
    console.log('🛑 Fechando servidor...');
    server.close(async () => {
        try {
            await db.end();
            console.log('💾 Banco de Dados desconectado.');
            process.exit(0);
        } catch (err) {
            console.error('❌ Erro ao fechar banco:', err);
            process.exit(1);
        }
    });
};


process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);