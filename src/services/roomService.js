const db = require('../config/db');

exports.getRoomItems = async (childId) => {
    // Busca itens comprados E junta com a info do catálogo (ícone, interação)
    const [items] = await db.execute(`
        SELECT i.id, i.item_key, i.x_position, i.y_position, i.is_placed,
               s.name, s.icon, s.interaction_type
        FROM child_inventory i
        JOIN shop_catalog s ON i.item_key = s.item_key
        WHERE i.child_id = ? AND i.is_placed = 1
    `, [childId]);
    return items;
};

exports.getInventory = async (childId) => {
    // Itens que a criança tem mas NÃO estão no quarto
    const [items] = await db.execute(`
        SELECT i.id, i.item_key, s.name, s.icon, s.price
        FROM child_inventory i
        JOIN shop_catalog s ON i.item_key = s.item_key
        WHERE i.child_id = ? AND i.is_placed = 0
    `, [childId]);
    return items;
};

exports.placeItem = async (inventoryId, x, y) => {
    await db.execute(
        'UPDATE child_inventory SET is_placed = 1, x_position = ?, y_position = ? WHERE id = ?',
        [x, y, inventoryId]
    );
};

exports.removeItem = async (inventoryId) => {
    await db.execute(
        'UPDATE child_inventory SET is_placed = 0 WHERE id = ?',
        [inventoryId]
    );
};

// Compra de mobília (lógica simplificada de saldo deve ser gerida no controller ou transação completa)
exports.addFurnitureToInventory = async (childId, itemKey) => {
    await db.execute(
        'INSERT INTO child_inventory (child_id, item_key, is_placed) VALUES (?, ?, 0)',
        [childId, itemKey]
    );
};

exports.buyFurniture = async (childId, itemKey, price) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Verificar Saldo
        const [child] = await connection.execute('SELECT pontos FROM children WHERE id = ?', [childId]);
        if (child[0].pontos < price) throw new Error('Saldo insuficiente.');

        // 2. Debitar Pontos
        await connection.execute('UPDATE children SET pontos = pontos - ? WHERE id = ?', [price, childId]);

        // 3. Adicionar ao Inventário
        await connection.execute(
            'INSERT INTO child_inventory (child_id, item_key, is_placed) VALUES (?, ?, 0)',
            [childId, itemKey]
        );

        // 4. Histórico Financeiro
        await connection.execute(
            'INSERT INTO points_history (child_id, pontos, tipo, motivo) VALUES (?, ?, ?, ?)',
            [childId, -price, 'perda', `Comprou Mobília`]
        );

        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};