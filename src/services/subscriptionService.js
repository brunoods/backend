const db = require('../config/db');
const { google } = require('googleapis');
const path = require('path');

// Caminho para o arquivo JSON baixado do Google Cloud
// Certifique-se de colocar o arquivo 'service-account.json' na raiz do projeto backend
const KEY_FILE_PATH = path.join(__dirname, '../../service-account.json');

exports.verify = async (userId, { purchaseToken, productId, packageName }) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        
        console.log(`🔍 Verificando assinatura: ${productId} para o pacote: ${packageName}`);

        // 1. Autenticação com o Google
        const auth = new google.auth.GoogleAuth({
            keyFile: KEY_FILE_PATH,
            scopes: ['https://www.googleapis.com/auth/androidpublisher']
        });

        const authClient = await auth.getClient();
        
        // 2. Cliente da API Android Publisher
        const androidPublisher = google.androidpublisher({
            version: 'v3',
            auth: authClient
        });

        // 3. Consultar o Google para validar o token
        // Use 'purchases.subscriptions.get' para assinaturas (mensal/anual)
        // Use 'purchases.products.get' se fossem itens únicos (moedas, vidas)
        const response = await androidPublisher.purchases.subscriptions.get({
            packageName: packageName,
            subscriptionId: productId,
            token: purchaseToken
        });

        const purchaseData = response.data;
        
        console.log('📊 Resposta do Google:', purchaseData);

        // --- LÓGICA DE VALIDAÇÃO REAL ---
        
        // expiryTimeMillis: Data de expiração da assinatura
        // paymentState: 
        // 1 = Pagamento recebido
        // 2 = Teste gratuito (Trial)
        // 0 = Pendente (Ainda não cobrou)
        
        const now = Date.now();
        const expiryTime = parseInt(purchaseData.expiryTimeMillis);
        
        // É válido se: (Pago OU Trial) E (Data de Expiração > Agora)
        const isPaymentValid = (purchaseData.paymentState === 1 || purchaseData.paymentState === 2);
        const isNotExpired = expiryTime > now;

        if (isPaymentValid && isNotExpired) {
            console.log('✅ Assinatura VÁLIDA!');
            
            const dataValidade = new Date(expiryTime);

            // Atualiza o usuário para PRO e define a data real de fim
            await connection.execute(
                'UPDATE users SET is_pro = 1, subscription_end_date = ? WHERE id = ?',
                [dataValidade, userId]
            );

            // (Opcional) Logar a transação
            // await connection.execute('INSERT INTO transactions ...');

            await connection.commit();
            return true;
        } else {
            console.warn('❌ Assinatura inválida, pendente ou expirada.');
            throw new Error('Assinatura inválida ou expirada.');
        }

    } catch (error) {
        await connection.rollback();
        console.error('❌ Erro na verificação Google:', error.message);
        
        // Dica: Se der erro "invalid_grant", verifique o relógio do servidor ou o arquivo JSON
        throw new Error('Falha ao validar compra com o Google. Tente novamente.');
    } finally {
        connection.release();
    }
};