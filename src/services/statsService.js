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

// --- NOVA FUNÇÃO: RESUMO MENSAL (Stories) ---
exports.getMonthlyRecap = async (childId, month, year) => {
    // Se não informar mês/ano, usa o atual
    const date = new Date();
    const m = month || (date.getMonth() + 1);
    const y = year || date.getFullYear();

    // 1. Totais Financeiros (Ganho vs Gasto no mês)
    const [totals] = await db.execute(`
        SELECT
            SUM(CASE WHEN tipo = 'ganho' THEN pontos ELSE 0 END) as total_ganho,
            SUM(CASE WHEN tipo = 'perda' THEN ABS(pontos) ELSE 0 END) as total_gasto
        FROM points_history
        WHERE child_id = ?
        AND MONTH(created_at) = ? AND YEAR(created_at) = ?
    `, [childId, m, y]);

    // 2. Tarefa Destaque (A que mais fez)
    const [topTask] = await db.execute(`
        SELECT t.nome, COUNT(*) as qtd
        FROM assigned_tasks at
        JOIN tasks t ON at.task_id = t.id
        WHERE at.child_id = ?
        AND MONTH(at.data) = ? AND YEAR(at.data) = ?
        AND at.status = 'aprovado'
        GROUP BY t.nome
        ORDER BY qtd DESC
        LIMIT 1
    `, [childId, m, y]);

    // 3. Maior Gasto (Onde o dinheiro foi?)
    const [topExpense] = await db.execute(`
        SELECT motivo, SUM(ABS(pontos)) as total
        FROM points_history
        WHERE child_id = ?
        AND tipo = 'perda'
        AND MONTH(created_at) = ? AND YEAR(created_at) = ?
        GROUP BY motivo
        ORDER BY total DESC
        LIMIT 1
    `, [childId, m, y]);

    // 4. Contagem total de tarefas
    const [taskCount] = await db.execute(`
        SELECT COUNT(*) as total
        FROM assigned_tasks
        WHERE child_id = ?
        AND status = 'aprovado'
        AND MONTH(data) = ? AND YEAR(data) = ?
    `, [childId, m, y]);

    return {
        periodo: { mes: m, ano: y },
        financeiro: totals[0], // { total_ganho, total_gasto }
        tarefaMaisFeita: topTask[0] || null, // { nome, qtd }
        maiorGasto: topExpense[0] || null, // { motivo, total }
        totalTarefasConcluidas: taskCount[0].total
    };
};