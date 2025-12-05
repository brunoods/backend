const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// Buscar configurações
exports.getSettings = asyncHandler(async (req, res) => {
    const parentId = req.user.id;
    
    let [settings] = await db.execute('SELECT * FROM settings WHERE parent_id = ?', [parentId]);

    if (settings.length === 0) {
        await db.execute(
            'INSERT INTO settings (parent_id, valor_ponto) VALUES (?, ?)',
            [parentId, 0.10]
        );
        [settings] = await db.execute('SELECT * FROM settings WHERE parent_id = ?', [parentId]);
    }

    res.json(settings[0]);
});

// Atualizar valor do ponto
exports.updateSettings = asyncHandler(async (req, res) => {
    const parentId = req.user.id;
    const { valorPonto } = req.body;

    await db.execute(
        'UPDATE settings SET valor_ponto = ? WHERE parent_id = ?',
        [valorPonto, parentId]
    );

    res.json({ mensagem: 'Configuração atualizada com sucesso!' });
});