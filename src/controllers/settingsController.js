const db = require('../config/db');

// Buscar configurações (Se não existir, cria o padrão)
exports.getSettings = async (req, res) => {
    try {
        const parentId = req.user.id;
        
        // Tenta buscar
        let [settings] = await db.execute('SELECT * FROM settings WHERE parent_id = ?', [parentId]);

        // Se não existir, cria a configuração padrão (R$ 0,10 por ponto)
        if (settings.length === 0) {
            await db.execute(
                'INSERT INTO settings (parent_id, valor_ponto) VALUES (?, ?)',
                [parentId, 0.10]
            );
            [settings] = await db.execute('SELECT * FROM settings WHERE parent_id = ?', [parentId]);
        }

        res.json(settings[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensagem: 'Erro ao buscar configurações.' });
    }
};

// Atualizar valor do ponto
exports.updateSettings = async (req, res) => {
    try {
        const parentId = req.user.id;
        const { valorPonto } = req.body; // Ex: 0.50

        await db.execute(
            'UPDATE settings SET valor_ponto = ? WHERE parent_id = ?',
            [valorPonto, parentId]
        );

        res.json({ mensagem: 'Configuração atualizada com sucesso!' });
    } catch (error) {
        res.status(500).json({ mensagem: 'Erro ao salvar configurações.' });
    }
};