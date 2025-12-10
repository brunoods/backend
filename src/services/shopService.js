const db = require('../config/db');

exports.getCatalog = async (category) => {
    let query = 'SELECT * FROM shop_catalog WHERE is_active = 1';
    const params = [];

    if (category) {
        query += ' AND category = ?';
        params.push(category);
    }

    query += ' ORDER BY price ASC';
    
    const [rows] = await db.execute(query, params);
    return rows;
};