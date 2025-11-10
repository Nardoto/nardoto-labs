// ========================================
// NARDOTO LABS - CLOUD FUNCTIONS
// Sistema centralizado de autenticação para extensões
// ========================================

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// ========================================
// CONFIGURAÇÃO DE PLANOS
// ========================================

const PLANS = {
  FREE: {
    id: 'free',
    name: 'Plano Grátis',
    price: 0,
    features: []
  },

  BASIC: {
    id: 'basic',
    name: 'Plano Básico',
    price: 197,
    features: [
      'veo3-automator',
      'wisk-automator',
      'tradutor-ai-unlimited'
    ]
  },

  VIP: {
    id: 'vip',
    name: 'Plano VIP',
    price: 397,
    features: [
      'all-features'  // Marca especial = acesso a TUDO
    ]
  }
};

// ========================================
// MAPEAMENTO: PRODUCT ID (KIWIFY) → PLAN ID
// ========================================
// ⚠️ SUBSTITUA PELOS IDS REAIS DOS SEUS PRODUTOS NO KIWIFY

const PRODUCT_TO_PLAN = {
  'COLE-AQUI-ID-BASICO': 'basic',
  'COLE-AQUI-ID-VIP': 'vip'
};

// ========================================
// WEBHOOK KIWIFY - Receber Pagamentos
// ========================================

exports.kiwifyWebhook = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(204).send('');
    }

    try {
        console.log('📥 Webhook recebido:', JSON.stringify(req.body, null, 2));

        const event = req.body;

        if (!event || !event.type) {
            console.error('❌ Evento inválido');
            return res.status(400).json({ error: 'Evento inválido' });
        }

        switch (event.type) {
            case 'order.paid':
                await handleOrderPaid(event);
                break;

            case 'subscription.canceled':
            case 'subscription.expired':
                await handleSubscriptionCanceled(event);
                break;

            case 'order.refunded':
                await handleOrderRefunded(event);
                break;

            default:
                console.log(`ℹ️ Evento não processado: ${event.type}`);
        }

        res.status(200).json({ success: true });

    } catch (error) {
        console.error('❌ Erro no webhook:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// HANDLER: Pagamento Aprovado
// ========================================

async function handleOrderPaid(event) {
    try {
        const { Customer, order_id, order_ref, Product, Subscription } = event;
        const customerEmail = Customer?.email;

        if (!customerEmail) {
            console.error('❌ Email do cliente não encontrado');
            return;
        }

        console.log(`💰 Pagamento aprovado para: ${customerEmail}`);

        let planId = null;

        // PRIORIDADE 1: Verificar nome do plano na subscription
        if (Subscription?.plan?.name) {
            const planName = Subscription.plan.name.toLowerCase();
            console.log(`📋 Nome do plano detectado: "${Subscription.plan.name}"`);

            if (planName.includes('vip')) {
                planId = 'vip';
                console.log('✅ Detectado: PLANO VIP');
            } else if (planName.includes('basico') || planName.includes('básico') || planName.includes('basic')) {
                planId = 'basic';
                console.log('✅ Detectado: PLANO BÁSICO');
            }
        }

        // PRIORIDADE 2: Verificar product_id (fallback)
        if (!planId) {
            const productId = Product?.product_id || Product?.id;
            console.log(`📦 Product ID: ${productId}`);
            planId = PRODUCT_TO_PLAN[productId];
        }

        // PRIORIDADE 3: Verificar product_name (fallback)
        if (!planId && Product?.product_name) {
            const productName = Product.product_name.toLowerCase();
            console.log(`📦 Product Name: "${Product.product_name}"`);

            if (productName.includes('vip')) {
                planId = 'vip';
            } else if (productName.includes('basico') || productName.includes('básico') || productName.includes('basic')) {
                planId = 'basic';
            }
        }

        // Fallback final: ativar BÁSICO
        if (!planId) {
            console.warn(`⚠️ Não foi possível detectar o plano. Ativando BÁSICO por segurança.`);
            planId = 'basic';
        }

        const plan = PLANS[planId.toUpperCase()];
        console.log(`📋 Plano final: ${planId} (${plan.name}) - R$ ${plan.price}`);

        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('email', '==', customerEmail).get();

        // Extrair productId antes de usar (necessário para ambos os casos)
        const productId = Product?.product_id || Product?.id || 'unknown';

        if (snapshot.empty) {
            console.log(`⚠️ Usuário não existe: ${customerEmail}`);
            console.log('💾 Criando ativação pendente...');

            await db.collection('pending_activations').add({
                email: customerEmail,
                orderId: order_id,
                orderRef: order_ref,
                productId: productId,
                plan: planId,
                features: plan.features,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                status: 'pending',
                source: 'kiwify'
            });

            console.log(`✅ Ativação pendente criada para: ${customerEmail}`);
            return;
        }

        const userDoc = snapshot.docs[0];
        const userId = userDoc.id;

        await usersRef.doc(userId).update({
            isPro: true,
            plan: planId,
            features: plan.features,
            kiwifyProductId: productId,
            kiwifyOrderId: order_id,
            kiwifyOrderRef: order_ref,
            proActivatedAt: admin.firestore.FieldValue.serverTimestamp(),
            proActivatedBy: 'kiwify',
            kiwifyCustomer: {
                email: customerEmail,
                name: Customer?.full_name || Customer?.first_name || '',
                productName: Product?.product_name || plan.name,
                purchaseDate: new Date().toISOString()
            }
        });

        console.log(`✅ ${plan.name} ativado para: ${customerEmail} (UID: ${userId})`);

    } catch (error) {
        console.error('❌ Erro ao processar pagamento:', error);
        throw error;
    }
}

// ========================================
// HANDLER: Assinatura Cancelada/Expirada
// ========================================

async function handleSubscriptionCanceled(event) {
    try {
        const { Customer } = event;
        const customerEmail = Customer?.email;

        if (!customerEmail) {
            console.error('❌ Email não encontrado');
            return;
        }

        console.log(`⚠️ Assinatura cancelada: ${customerEmail}`);

        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('email', '==', customerEmail).get();

        if (snapshot.empty) {
            console.log(`⚠️ Usuário não encontrado: ${customerEmail}`);
            return;
        }

        const userDoc = snapshot.docs[0];
        const userId = userDoc.id;

        await usersRef.doc(userId).update({
            isPro: false,
            plan: 'free',
            features: PLANS.FREE.features,
            proCanceledAt: admin.firestore.FieldValue.serverTimestamp(),
            proCancelReason: 'subscription_canceled'
        });

        console.log(`✅ Plano cancelado: ${customerEmail} → FREE (UID: ${userId})`);

    } catch (error) {
        console.error('❌ Erro ao cancelar:', error);
        throw error;
    }
}

// ========================================
// HANDLER: Pedido Reembolsado
// ========================================

async function handleOrderRefunded(event) {
    try {
        const { Customer } = event;
        const customerEmail = Customer?.email;

        if (!customerEmail) {
            console.error('❌ Email não encontrado');
            return;
        }

        console.log(`💸 Reembolso para: ${customerEmail}`);

        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('email', '==', customerEmail).get();

        if (snapshot.empty) {
            console.log(`⚠️ Usuário não encontrado: ${customerEmail}`);
            return;
        }

        const userDoc = snapshot.docs[0];
        const userId = userDoc.id;

        await usersRef.doc(userId).update({
            isPro: false,
            plan: 'free',
            features: PLANS.FREE.features,
            proCanceledAt: admin.firestore.FieldValue.serverTimestamp(),
            proCancelReason: 'order_refunded'
        });

        console.log(`✅ Reembolsado: ${customerEmail} → FREE (UID: ${userId})`);

    } catch (error) {
        console.error('❌ Erro ao reembolsar:', error);
        throw error;
    }
}

// ========================================
// FUNÇÃO: Verificar Ativações Pendentes
// ========================================
// Chamada automaticamente quando usuário faz login

exports.checkPendingActivations = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Não autenticado');
        }

        const uid = context.auth.uid;
        const email = context.auth.token.email;

        console.log(`🔍 Verificando ativações pendentes: ${email}`);

        const pendingRef = db.collection('pending_activations');
        const snapshot = await pendingRef
            .where('email', '==', email)
            .where('status', '==', 'pending')
            .get();

        if (snapshot.empty) {
            console.log(`ℹ️ Sem ativações pendentes: ${email}`);
            return { activated: false };
        }

        const userRef = db.collection('users').doc(uid);
        const pendingDoc = snapshot.docs[0];
        const pendingData = pendingDoc.data();

        const planId = pendingData.plan || 'basic';
        const plan = PLANS[planId.toUpperCase()];

        console.log(`💰 Ativando ${plan.name} para: ${email}`);

        await userRef.update({
            isPro: true,
            plan: planId,
            features: pendingData.features || plan.features,
            proActivatedAt: admin.firestore.FieldValue.serverTimestamp(),
            proActivatedBy: 'kiwify_pending',
            kiwifyOrderId: pendingData.orderId,
            kiwifyOrderRef: pendingData.orderRef,
            kiwifyProductId: pendingData.productId
        });

        await pendingDoc.ref.update({
            status: 'processed',
            processedAt: admin.firestore.FieldValue.serverTimestamp(),
            userId: uid
        });

        console.log(`✅ Ativação pendente processada: ${email}`);

        return { activated: true, plan: planId };

    } catch (error) {
        console.error('❌ Erro:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
