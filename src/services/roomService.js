const db = require('../config/db');

exports.getRoomItems = async (childId) => {
    // Mantemos esta query para compatibilidade com o sistema antigo de mobília posicionável,
    // caso ainda existam itens legados "colocados" no quarto.
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
    // CORREÇÃO: Removemos o INNER JOIN com shop_catalog.
    // Agora buscamos TUDO o que está no inventário (Temas, Mobílias, Pets, etc.)
    // Apenas retornamos o item_key, que é o que o Frontend precisa para validar a posse.
    const [items] = await db.execute(`
        SELECT DISTINCT item_key 
        FROM child_inventory 
        WHERE child_id = ?
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

exports.buyFurniture = async (childId, itemKey, price) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Verificar Saldo
        const [child] = await connection.execute('SELECT pontos FROM children WHERE id = ?', [childId]);
        if (child.length === 0) throw new Error('Criança não encontrada.');
        if (child[0].pontos < price) throw new Error('Saldo insuficiente.');

        // 2. Debitar Pontos
        await connection.execute('UPDATE children SET pontos = pontos - ? WHERE id = ?', [price, childId]);

        // 3. Adicionar ao Inventário
        // Nota: is_placed = 0 por padrão. O sistema de temas não usa is_placed, apenas verifica a existência no inventário.
        await connection.execute(
            'INSERT INTO child_inventory (child_id, item_key, is_placed) VALUES (?, ?, 0)',
            [childId, itemKey]
        );

        // 4. Registar no Extrato
        await connection.execute(
            'INSERT INTO points_history (child_id, pontos, tipo, motivo) VALUES (?, ?, ?, ?)',
            [childId, -price, 'perda', `Comprou Item de Loja`]
        );

        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};