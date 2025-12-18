const db = require('../config/db');

// REMOVIDO: const PET_CATALOG = { ... }

exports.listOwned = async (childId) => {
    // Agora fazemos um JOIN para trazer os detalhes do pet (nome, preço) direto da tabela nova
    const [rows] = await db.execute(`
        SELECT cp.pet_code, cp.is_equipped, pc.name 
        FROM child_pets cp
        JOIN pet_catalog pc ON cp.pet_code = pc.pet_code
        WHERE cp.child_id = ?
    `, [childId]);
    return rows;
};

exports.buy = async (childId, petCode) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Buscar info do Pet na base de dados
        const [pets] = await connection.execute(
            'SELECT * FROM pet_catalog WHERE pet_code = ? AND is_active = 1', 
            [petCode]
        );
        
        if (pets.length === 0) throw new Error('Pet inválido ou indisponível.');
        const petInfo = pets[0];

        // 2. Verifica se já tem
        const [existing] = await connection.execute(
            'SELECT id FROM child_pets WHERE child_id = ? AND pet_code = ?',
            [childId, petCode]
        );
        if (existing.length > 0) throw new Error('Você já tem este mascote!');

        // 3. Verifica saldo
        const [child] = await connection.execute('SELECT pontos FROM children WHERE id = ?', [childId]);
        if (child[0].pontos < petInfo.price) throw new Error(`Saldo insuficiente. Custa ${petInfo.price} pts.`);

        // 4. Efetua a compra
        await connection.execute('UPDATE children SET pontos = pontos - ? WHERE id = ?', [petInfo.price, childId]);
        await connection.execute('INSERT INTO child_pets (child_id, pet_code) VALUES (?, ?)', [childId, petCode]);
        await connection.execute('INSERT INTO points_history (child_id, pontos, tipo, motivo) VALUES (?, ?, ?, ?)', [childId, -petInfo.price, 'perda', `Comprou Pet: ${petInfo.name}`]);

        await connection.commit();
        return petInfo.name;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

exports.equip = async (childId, petCode) => {
    await db.execute('UPDATE child_pets SET is_equipped = 0 WHERE child_id = ?', [childId]);
    await db.execute('UPDATE child_pets SET is_equipped = 1 WHERE child_id = ? AND pet_code = ?', [childId, petCode]);
};