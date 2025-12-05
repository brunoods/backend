const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const db = require('./config/db');

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

app.use(cors());
app.use(express.json());

// Rota de teste
app.get('/', (req, res) => {
    res.json({
        mensagem: 'API do Sistema de Mesada está online!',
        status: 200,
        data_hora: new Date()
    });
});

// Definição das Rotas da API
app.use('/auth', authRoutes);         // Login e Registro
app.use('/children', childrenRoutes); // Gerenciar Filhos
app.use('/tasks', tasksRoutes);       // Gerenciar Tarefas
app.use('/ops', operationsRoutes);    // Pontuar, Punir e Extrato
app.use('/rewards', rewardsRoutes);   // Recompensas da Loja
app.use('/settings', settingsRoutes); // Configurações Gerais
app.use('/stats', statsRoutes);       // Estatísticas
app.use('/milestones', milestonesRoutes); // Conquistas e Marcos
app.use('/savings', savingsRoutes);   // Cofres e Metas de Poupança
app.use('/loans', loansRoutes);       // Empréstimos e Gestão Financeira
app.use('/subscribe', subscriptionRoutes); // Assinaturas PRO
app.use('/pets', petsRoutes);         // Pets Virtuais

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📡 Acesso local: http://localhost:${PORT}`);
    console.log(`🛠️ Rotas de operações disponíveis em /ops`);
});