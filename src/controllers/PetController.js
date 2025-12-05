const db = require('../config/db');

// Lista de Pets disponíveis (Catalogo Hardcoded no Backend para validação)
const PET_CATALOG = {
    'dog': { price: 200, name: 'Cachorrinho' },
    'cat': { price: 200, name: 'Gatinho' },
    'hamster': { price: 150, name: 'Hamster' },
    'dragon': { price: 500, name: 'Dragão Místico' },
    'robot': { price: 300, name: 'Robô-Pet' },
    'dino': { price: 400, name: 'Dinossauro' }
};

exports.listMyPets = async (req, res) => {
    try {
        const { childId } = req.params;
        // Retorna todos os pets que a criança já comprou
        const [rows] = await db.execute(
            'SELECT pet_code, is_equipped FROM child_pets WHERE child_id = ?', 
            [childId]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ mensagem: 'Erro ao buscar pets.' });
    }
};

exports.buyPet = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const { childId, petCode } = req.body;
        const petInfo = PET_CATALOG[petCode];

        if (!petInfo) throw new Error('Pet inválido.');

        // 1. Verifica se já tem o pet
        const [existing] = await connection.execute(
            'SELECT id FROM child_pets WHERE child_id = ? AND pet_code = ?',
            [childId, petCode]
        );
        if (existing.length > 0) throw new Error('Você já tem este mascote!');

        // 2. Verifica saldo
        const [child] = await connection.execute('SELECT pontos FROM children WHERE id = ?', [childId]);
        if (child[0].pontos < petInfo.price) throw new Error(`Saldo insuficiente. Custa ${petInfo.price} pts.`);

        // 3. Desconta saldo
        await connection.execute(
            'UPDATE children SET pontos = pontos - ? WHERE id = ?',
            [petInfo.price, childId]
        );

        // 4. Adiciona Pet
        await connection.execute(
            'INSERT INTO child_pets (child_id, pet_code) VALUES (?, ?)',
            [childId, petCode]
        );

        // 5. Histórico
        await connection.execute(
            'INSERT INTO points_history (child_id, pontos, tipo, motivo) VALUES (?, ?, ?, ?)',
            [childId, -petInfo.price, 'perda', `Comprou Pet: ${petInfo.name}`]
        );

        await connection.commit();
        res.json({ mensagem: `${petInfo.name} comprado com sucesso!` });

    } catch (error) {
        await connection.rollback();
        res.status(400).json({ mensagem: error.message || 'Erro na compra.' });
    } finally {
        connection.release();
    }
};

exports.equipPet = async (req, res) => {
    try {
        const { childId, petCode } = req.body;

        // Desmarca todos
        await db.execute('UPDATE child_pets SET is_equipped = 0 WHERE child_id = ?', [childId]);
        
        // Marca o escolhido
        await db.execute('UPDATE child_pets SET is_equipped = 1 WHERE child_id = ? AND pet_code = ?', [childId, petCode]);

        res.json({ mensagem: 'Pet equipado!' });
    } catch (error) {
        res.status(500).json({ mensagem: 'Erro ao equipar.' });
    }
};