const db = require('../config/db');

exports.get = async (parentId) => {
    let [settings] = await db.execute('SELECT * FROM settings WHERE parent_id = ?', [parentId]);

    if (settings.length === 0) {
        await db.execute(
            'INSERT INTO settings (parent_id, valor_ponto) VALUES (?, ?)',
            [parentId, 0.10]
        );
        [settings] = await db.execute('SELECT * FROM settings WHERE parent_id = ?', [parentId]);
    }
    return settings[0];
};

exports.update = async (parentId, valorPonto) => {
    await db.execute(
        'UPDATE settings SET valor_ponto = ? WHERE parent_id = ?',
        [valorPonto, parentId]
    );
};