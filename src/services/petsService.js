const db = require('../config/db');

// Catálogo Hardcoded para validação de preço
const PET_CATALOG = {
    'dog': { price: 200, name: 'Cachorrinho' },
    'cat': { price: 200, name: 'Gatinho' },
    'hamster': { price: 150, name: 'Hamster' },
    'lion': { price: 500, name: 'Leão' },
    'robot': { price: 300, name: 'Robô-Pet' },
    'dino': { price: 400, name: 'Dinossauro' }
};

exports.listOwned = async (childId) => {
    const [rows] = await db.execute(
        'SELECT pet_code, is_equipped FROM child_pets WHERE child_id = ?', 
        [childId]
    );
    return rows;
};

exports.buy = async (childId, petCode) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const petInfo = PET_CATALOG[petCode];

        if (!petInfo) throw new Error('Pet inválido.');

        const [existing] = await connection.execute(
            'SELECT id FROM child_pets WHERE child_id = ? AND pet_code = ?',
            [childId, petCode]
        );
        if (existing.length > 0) throw new Error('Você já tem este mascote!');

        const [child] = await connection.execute('SELECT pontos FROM children WHERE id = ?', [childId]);
        if (child[0].pontos < petInfo.price) throw new Error(`Saldo insuficiente. Custa ${petInfo.price} pts.`);

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