const db = require('../config/db');
// const { google } = require('googleapis'); // Usar quando tiver a chave real

exports.verifyPurchase = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        
        const userId = req.user.id; // ID do pai logado
        const { purchaseToken, productId, platform } = req.body;

        console.log('Verificando compra:', productId);

        // --- VALIDAÇÃO REAL COM GOOGLE (Para quando tiveres a chave) ---
        // 1. Autenticar com googleapis usando seu service-account.json
        // 2. Chamar androidPublisher.purchases.subscriptions.get(...)
        // 3. Se retornar status válido, prosseguir.

        // --- SIMULAÇÃO PARA TESTE (REMOVE ISTO EM PRODUÇÃO) ---
        const isValid = true; 
        
        if (isValid) {
            // Define validade (ex: 30 dias)
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
        console.error(error);
        res.status(400).json({ success: false, message: 'Falha na verificação.' });
    } finally {
        connection.release();
    }
};