const db = require('../config/db');
const { google } = require('googleapis');
const path = require('path');

// Certifique-se que este ficheiro existe e tem permissões na Google Play Console
const KEY_FILE_PATH = path.join(__dirname, '../../service-account.json');

const SERVICE_ACCOUNT_PATH = process.env.NODE_ENV === 'production' 
    ? '/etc/secrets/service-account.json'
    : path.join(__dirname, '../service-account.json');

exports.verify = async (userId, { purchaseToken, productId, packageName }) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        
        console.log(`🔍 Validando Google: ${productId} | User: ${userId}`);

        // 1. Autenticação
        const auth = new google.auth.GoogleAuth({
            keyFile: KEY_FILE_PATH,
            scopes: ['https://www.googleapis.com/auth/androidpublisher']
        });

        const authClient = await auth.getClient();
        
        // 2. Cliente API
        const androidPublisher = google.androidpublisher({
            version: 'v3',
            auth: authClient
        });

        // 3. Consulta ao Google
        // productId aqui deve ser o ID do Produto Pai ('mesadinhapremium') ou o ID antigo
        const response = await androidPublisher.purchases.subscriptions.get({
            packageName: packageName,
            subscriptionId: productId, 
            token: purchaseToken
        });

        const purchaseData = response.data;
        console.log('📊 Google Status:', purchaseData.paymentState, '| Expira:', purchaseData.expiryTimeMillis);

        // 4. Lógica de Validação
        // paymentState: 1 (Recebido), 2 (Trial)
        const now = Date.now();
        const expiryTime = parseInt(purchaseData.expiryTimeMillis);
        
        // Nota: O Google dá um tempo de carência (grace period), podes querer aceitar isso também
        const isPaymentValid = (purchaseData.paymentState === 1 || purchaseData.paymentState === 2);
        const isNotExpired = expiryTime > now;

        if (isPaymentValid && isNotExpired) {
            const dataValidade = new Date(expiryTime);

            // Atualiza User
            await connection.execute(
                'UPDATE users SET is_pro = 1, subscription_end_date = ? WHERE id = ?',
                [dataValidade, userId]
            );

            await connection.commit();
            return true;
        } else {
            throw new Error('Assinatura expirada ou pagamento pendente.');
        }

    } catch (error) {
        await connection.rollback();
        // Erro comum: "Subscription not found" se o productId estiver errado
        console.error('❌ Erro Service:', error.message);
        throw error; // Lança para o controller pegar
    } finally {
        connection.release();
    }
};