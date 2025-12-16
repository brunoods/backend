const subscriptionService = require('../services/subscriptionService');
const asyncHandler = require('../utils/asyncHandler');

exports.verifyPurchase = asyncHandler(async (req, res) => {
    const { id: userId } = req.user;
    const { receipt, platform, productId } = req.body;

    // Validação básica
    if (!receipt || !platform || !productId) {
        return res.status(400).json({ message: 'Dados incompletos.' });
    }

    if (platform === 'android') {
        try {
            // O recibo no Android vem como uma String JSON, precisamos fazer parse
            // Ex: "{\"orderId\":\"...\",\"purchaseToken\":\"...\"}"
            const receiptData = typeof receipt === 'string' ? JSON.parse(receipt) : receipt;

            const purchaseToken = receiptData.purchaseToken;
            const packageName = receiptData.packageName;

            if (!purchaseToken || !packageName) {
                return res.status(400).json({ message: 'Token de compra não encontrado no recibo.' });
            }

            // Chama o serviço com os dados "limpos"
            await subscriptionService.verify(userId, { 
                purchaseToken, 
                productId, // Deve ser 'mesadinhapremium'
                packageName 
            });

        } catch (error) {
            console.error('Erro ao processar recibo Android:', error);
            return res.status(400).json({ message: 'Recibo inválido ou mal formatado.' });
        }
    } else {
        // Futuro: Implementação iOS
        return res.status(400).json({ message: 'Validação iOS ainda não implementada.' });
    }

    res.json({ success: true, message: 'Assinatura PRO ativada com sucesso!' });
});