const cron = require('node-cron');
const db = require('../config/db');

const resetTasks = async () => {
    console.log('🌙 [CRON] Iniciando reset diário das tarefas...');
    const FUSO_HORARIO = 'INTERVAL 3 HOUR'; 
    
    try {
        const connection = await db.getConnection();
        
        // Reset Diário
        const [resDiario] = await connection.execute(`
            UPDATE tasks SET completed = 0 
            WHERE frequencia = 'diaria' AND completed = 1
            AND DATE(DATE_SUB(data_ultima_conclusao, ${FUSO_HORARIO})) < DATE(DATE_SUB(NOW(), ${FUSO_HORARIO}))
        `);

        // Reset Semanal (Segunda-feira = Start da semana)
        const [resSemanal] = await connection.execute(`
            UPDATE tasks SET completed = 0 
            WHERE frequencia = 'semanal' AND completed = 1
            AND YEARWEEK(DATE_SUB(data_ultima_conclusao, ${FUSO_HORARIO}), 1) < YEARWEEK(DATE_SUB(NOW(), ${FUSO_HORARIO}), 1)
        `);

        console.log(`✅ [CRON] Tarefas resetadas! Diárias: ${resDiario.affectedRows}, Semanais: ${resSemanal.affectedRows}`);
        connection.release();
    } catch (error) {
        console.error('❌ [CRON] Erro:', error);
    }
};

const startCron = () => {
    // Executa todos os dias às 03:00 da manhã
    cron.schedule('0 3 * * *', resetTasks);
    console.log('⏰ Cron Job iniciado: Reset diário agendado para as 03:00.');
};

module.exports = startCron;