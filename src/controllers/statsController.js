const db = require('../config/db');

exports.getChildStats = async (req, res) => {
    try {
        const { childId } = req.params;

        // 1. Total ganho no mês atual (apenas ganhos)
        const [mesAtual] = await db.execute(`
            SELECT COALESCE(SUM(pontos), 0) as total 
            FROM points_history 
            WHERE child_id = ? AND tipo = 'ganho' 
            AND MONTH(created_at) = MONTH(CURRENT_DATE()) 
            AND YEAR(created_at) = YEAR(CURRENT_DATE())
        `, [childId]);

        // 2. Total de tarefas concluídas (desde sempre)
        const [tarefasFeitas] = await db.execute(`
            SELECT COUNT(*) as total 
            FROM assigned_tasks 
            WHERE child_id = ? AND status = 'aprovado'
        `, [childId]);

        // 3. Dados para o gráfico (Ganhos dos últimos 7 dias)
        const [grafico] = await db.execute(`
            SELECT DATE_FORMAT(created_at, '%d/%m') as dia, SUM(pontos) as total
            FROM points_history
            WHERE child_id = ? AND tipo = 'ganho'
            AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY DATE(created_at), DATE_FORMAT(created_at, '%d/%m')
            ORDER BY DATE(created_at) ASC
        `, [childId]);

        res.json({
            ganhosMes: mesAtual[0].total,
            tarefasTotal: tarefasFeitas[0].total,
            grafico: grafico
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ mensagem: 'Erro ao calcular estatísticas.' });
    }
};

// --- NOVA FUNÇÃO: RANKINGS (GERAL E SEMANAL) ---
exports.getRankings = async (req, res) => {
    try {
        const parentId = req.user.id;

        // 1. Ranking Geral (Baseado em XP - Nunca zera)
        const [geral] = await db.execute(`
            SELECT id, nome, avatar, cor_fundo, xp as pontos 
            FROM children 
            WHERE parent_id = ? 
            ORDER BY xp DESC
        `, [parentId]);

        // 2. Ranking Semanal (Soma de ganhos desta semana - Segunda a Domingo)
        // YEARWEEK(date, 1) usa o modo onde a semana começa na Segunda-feira.
        const [semanal] = await db.execute(`
            SELECT 
                c.id, 
                c.nome, 
                c.avatar, 
                c.cor_fundo, 
                COALESCE(SUM(ph.pontos), 0) as pontos
            FROM children c
            LEFT JOIN points_history ph ON c.id = ph.child_id 
                AND ph.tipo = 'ganho'
                AND YEARWEEK(ph.created_at, 1) = YEARWEEK(NOW(), 1)
            WHERE c.parent_id = ?
            GROUP BY c.id
            ORDER BY pontos DESC
        `, [parentId]);

        res.json({ geral, semanal });

    } catch (error) {
        console.error(error);
        res.status(500).json({ mensagem: 'Erro ao buscar rankings.' });
    }
};