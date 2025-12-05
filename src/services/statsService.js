const db = require('../config/db');

exports.getChildStats = async (childId) => {
    const [mesAtual] = await db.execute(`
        SELECT COALESCE(SUM(pontos), 0) as total 
        FROM points_history 
        WHERE child_id = ? AND tipo = 'ganho' 
        AND MONTH(created_at) = MONTH(CURRENT_DATE()) 
        AND YEAR(created_at) = YEAR(CURRENT_DATE())
    `, [childId]);

    const [tarefasFeitas] = await db.execute(`
        SELECT COUNT(*) as total 
        FROM assigned_tasks 
        WHERE child_id = ? AND status = 'aprovado'
    `, [childId]);

    const [grafico] = await db.execute(`
        SELECT DATE_FORMAT(created_at, '%d/%m') as dia, SUM(pontos) as total
        FROM points_history
        WHERE child_id = ? AND tipo = 'ganho'
        AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY DATE(created_at), DATE_FORMAT(created_at, '%d/%m')
        ORDER BY DATE(created_at) ASC
    `, [childId]);

    return {
        ganhosMes: mesAtual[0].total,
        tarefasTotal: tarefasFeitas[0].total,
        grafico: grafico
    };
};

exports.getRankings = async (parentId) => {
    const [geral] = await db.execute(`
        SELECT id, nome, avatar, cor_fundo, xp as pontos 
        FROM children 
        WHERE parent_id = ? 
        ORDER BY xp DESC
    `, [parentId]);

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

    return { geral, semanal };
};