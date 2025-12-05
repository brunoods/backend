const db = require('../config/db');
const { google } = require('googleapis'); 
const asyncHandler = require('../utils/asyncHandler');

exports.verifyPurchase = asyncHandler(async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        
        const userId = req.user.id;
        const { purchaseToken, productId, platform } = req.body;

        console.log('Verificando compra:', productId);

        // --- SIMULAÇÃO PARA TESTE ---
        const isValid = false; 
        
        if (isValid) {
            const validade = new Date();
            validade.setDate(validade.getDate() + 30);

            await connection.execute(
                'UPDATE users SET is_pro = 1, subscription_end_date = ? WHERE id = ?',
                [validade, userId]
            );

            await connection.commit();
            res.json({ success: true, message: 'Assinatura ativada!' });
        } else {
            throw new Error('Token de compra inválido.');
        }

    } catch (error) {
        await connection.rollback();
        error.statusCode = 400;
        throw error;
    } finally {
        connection.release();
    }
});