const db = require('../config/db');

exports.verify = async (userId, { purchaseToken, productId }) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        
        console.log('Verificando compra:', productId);

        // --- LÓGICA DE VALIDAÇÃO ---
        const isValid = false; // Mudar para true ou implementar Google API real
        
        if (isValid) {
            const validade = new Date();
            validade.setDate(validade.getDate() + 30);

            await connection.execute(
                'UPDATE users SET is_pro = 1, subscription_end_date = ? WHERE id = ?',
                [validade, userId]
            );

            await connection.commit();
            return true;
        } else {
            throw new Error('Token de compra inválido.');
        }
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};