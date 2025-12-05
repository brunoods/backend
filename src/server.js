const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet'); // <--- NOVO (Segurança)
const compression = require('compression'); // <--- NOVO (Performance)
const db = require('./config/db');
const errorMiddleware = require('./middleware/errorMiddleware'); // <--- NOVO

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

// --- MIDDLEWARES GLOBAIS ---
app.use(helmet()); // Adiciona headers de segurança HTTP
app.use(compression()); // Comprime as respostas JSON (mais rápido no 4G)
app.use(cors());
app.use(express.json());

// Rota de teste
app.get('/', (req, res) => {
    res.json({
        mensagem: 'API do Sistema de Mesada está online! 🚀',
        status: 200,
        uptime: process.uptime()
    });
});

// --- ROTAS ---
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

// --- TRATAMENTO DE ERRO CENTRALIZADO ---
// Deve ser o último app.use()
app.use(errorMiddleware);

app.listen(PORT, () => {
    console.log(`🚀 Servidor otimizado rodando na porta ${PORT}`);
});