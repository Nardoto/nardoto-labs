// auth-manager.js - Sistema de AutenticaÃ§Ã£o VEO3 Automator
// Desenvolvido por: Nardoto
console.log("ðŸ” Auth Manager: Carregando...");

// ConfiguraÃ§Ã£o
const EXTENSION_ID = 'template-extension';
const REQUIRED_PLANS = ['basic', 'vip'];  // VEO3 estÃ¡ incluÃ­do em ambos os planos
const FREE_TRIAL_DAYS = 3;  // 3 dias de trial gratuito para usuÃ¡rios FREE
const FREE_TRIAL_DAILY_LIMIT = 15;  // 15 envios grátis por dia para usuários FREE

/**
 * Inicializa sistema de autenticaÃ§Ã£o
 */
async function initAuthSystem() {
  console.log("ðŸ” Inicializando sistema de autenticaÃ§Ã£o VEO3...");

  try {
    // Aguardar Firebase estar pronto
    const firebaseReady = await window.firebaseTEMPLATE.initialize();
    if (!firebaseReady) {
      console.error("âŒ Firebase nÃ£o inicializou corretamente");
      return {
        success: false,
        isAuthenticated: false,
        hasAccess: false,
        message: "Erro ao conectar com servidor de autenticaÃ§Ã£o"
      };
    }

    const auth = window.firebaseTEMPLATE.getAuth();

    // Aguardar estado de autenticaÃ§Ã£o
    return new Promise((resolve) => {
      let resolved = false;
      let unsubscribe = null;

      const resolveOnce = (result) => {
        if (resolved) return;
        resolved = true;
        if (unsubscribe) {
          try { unsubscribe(); } catch (e) {}
        }
        resolve(result);
      };

      unsubscribe = auth.onAuthStateChanged(async (user) => {
        if (resolved) return;

        console.log("ðŸ” onAuthStateChanged chamado, user:", user ? user.email : null);

        if (user) {
          console.log("âœ… UsuÃ¡rio autenticado:", user.email);
          console.log("ðŸ‘¤ UID:", user.uid);

          // Verificar acesso ao VEO3 Automator
          const accessCheck = await checkUserAccess(user.uid);

          resolveOnce({
            success: true,
            isAuthenticated: true,
            hasAccess: accessCheck.hasAccess,
            user: {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL
            },
            plan: accessCheck.plan,
            features: accessCheck.features,
            message: accessCheck.message,
            hasTrial: accessCheck.hasTrial,
            trialDaysRemaining: accessCheck.trialDaysRemaining,
            trialExpiresAt: accessCheck.trialExpiresAt
          });
        } else {
          console.log("âš ï¸ Nenhum usuÃ¡rio autenticado");
          resolveOnce({
            success: true,
            isAuthenticated: false,
            hasAccess: false,
            plan: 'free',
            features: [],
            message: "FaÃ§a login para usar o VEO3 Automator"
          });
        }
      });

      // Timeout de seguranÃ§a (5 segundos)
      setTimeout(() => {
        console.warn("âš ï¸ Timeout na verificaÃ§Ã£o de autenticaÃ§Ã£o");
        resolveOnce({
          success: false,
          isAuthenticated: false,
          hasAccess: false,
          plan: 'free',
          features: [],
          message: "Timeout ao verificar autenticaÃ§Ã£o"
        });
      }, 5000);
    });

  } catch (error) {
    console.error("âŒ Erro ao inicializar autenticaÃ§Ã£o:", error);
    return {
      success: false,
      isAuthenticated: false,
      hasAccess: false,
      plan: 'free',
      features: [],
      message: "Erro ao verificar autenticaÃ§Ã£o"
    };
  }
}

/**
 * Verifica se usuÃ¡rio tem acesso ao VEO3 Automator
 */
async function checkUserAccess(uid) {
  try {
    console.log("ðŸ” Verificando acesso do usuÃ¡rio no Firestore...");

    const db = window.firebaseTEMPLATE.getDb();
    const userDoc = await db.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      console.warn("âš ï¸ UsuÃ¡rio nÃ£o encontrado no Firestore");
      return {
        hasAccess: false,
        plan: 'free',
        features: [],
        message: "UsuÃ¡rio nÃ£o encontrado. FaÃ§a login no Tradutor AI primeiro."
      };
    }

    const userData = userDoc.data();
    const userPlan = userData.plan || 'free';
    const features = userData.features || [];

    console.log(`ðŸ"‹ DEBUG - Plano do usuÃ¡rio: ${userPlan}`);
    console.log(`ðŸŽ¯ DEBUG - Features: [${features.join(', ')}]`);
    console.log(`ðŸ"¦ DEBUG - isPro: ${userData.isPro}`);
    console.log(`ðŸ" DEBUG - EXTENSION_ID: ${EXTENSION_ID}`);
    console.log(`ðŸ" DEBUG - REQUIRED_PLANS:`, REQUIRED_PLANS);
    console.log(`ðŸ" DEBUG - features.includes(EXTENSION_ID):`, features.includes(EXTENSION_ID));
    console.log(`ðŸ" DEBUG - features.includes('all-features'):`, features.includes('all-features'));
    console.log(`ðŸ" DEBUG - REQUIRED_PLANS.includes(userPlan):`, REQUIRED_PLANS.includes(userPlan));

    // Verificar se tem acesso ao VEO3
    const hasAccess =
      features.includes(EXTENSION_ID) ||      // Tem feature especÃ­fica veo3-automator
      features.includes('all-features') ||     // Tem acesso total (VIP)
      REQUIRED_PLANS.includes(userPlan);       // Plano BÃSICO ou VIP

    if (hasAccess) {
      console.log("âœ… UsuÃ¡rio TEM acesso ao VEO3 Automator!");
      return {
        hasAccess: true,
        plan: userPlan,
        features: features,
        message: `Bem-vindo! Plano ${userPlan.toUpperCase()} ativo`,
        userData: userData,
        hasTrial: false,
        trialDaysRemaining: -1,  // Ilimitado
        trialExpiresAt: null
      };
    } else {
      // UsuÃ¡rio FREE - verificar trial gratuito (3 dias)
      console.log("ðŸ’¡ UsuÃ¡rio FREE - Verificando trial gratuito (3 dias)...");

      const trialStatus = checkTrialStatus(userData);

      if (trialStatus.isActive) {
        // Verificar uso diário para calcular envios restantes
        const dailyUsage = await checkDailyUsage(uid, userData);
        const remainingSubmissions = FREE_TRIAL_DAILY_LIMIT - (dailyUsage.count || 0);

        console.log(`âœ… Trial ativo: ${trialStatus.daysRemaining} dias restantes (expira em ${trialStatus.expiresAt})`);
        console.log(`ðŸ"Š Uso hoje: ${dailyUsage.count}/${FREE_TRIAL_DAILY_LIMIT} envios`);

        return {
          hasAccess: true,  // Tem acesso via trial
          plan: userPlan,
          features: features,
          message: `Trial: ${trialStatus.daysRemaining} dias restantes`,
          userData: userData,
          hasTrial: true,
          isTrialActive: true,
          trialDaysRemaining: trialStatus.daysRemaining,
          trialExpiresAt: trialStatus.expiresAt,
          dailyLimit: FREE_TRIAL_DAILY_LIMIT,
          remainingSubmissions: remainingSubmissions
        };
      } else {
        console.log("âŒ Trial expirado (3 dias)");
        return {
          hasAccess: false,
          plan: userPlan,
          features: features,
          message: `Trial de 3 dias expirado. FaÃ§a upgrade para BÃSICO ou VIP!`,
          userData: userData,
          hasTrial: true,
          trialDaysRemaining: 0,
          trialExpiresAt: trialStatus.expiresAt
        };
      }
    }

  } catch (error) {
    console.error("âŒ Erro ao verificar acesso:", error);
    return {
      hasAccess: false,
      plan: 'free',
      features: [],
      message: "Erro ao verificar acesso"
    };
  }
}

/**
 * Verifica status do trial de 3 dias
 */
function checkTrialStatus(userData) {
  try {
    // Pegar data de criaÃ§Ã£o do usuÃ¡rio
    const createdAt = userData.createdAt;

    if (!createdAt) {
      console.warn("âš ï¸ createdAt nÃ£o encontrado, considerando trial expirado");
      return {
        isActive: false,
        daysRemaining: 0,
        expiresAt: null
      };
    }

    // Converter createdAt para timestamp
    let createdTimestamp;
    if (typeof createdAt === 'string') {
      createdTimestamp = new Date(createdAt).getTime();
    } else if (createdAt._seconds) {
      // Firestore Timestamp format
      createdTimestamp = createdAt._seconds * 1000;
    } else {
      createdTimestamp = createdAt;
    }

    const now = Date.now();
    const trialDurationMs = FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000;  // 3 dias em ms
    const trialExpiresAt = createdTimestamp + trialDurationMs;
    const timeRemaining = trialExpiresAt - now;
    const daysRemaining = Math.ceil(timeRemaining / (24 * 60 * 60 * 1000));

    const isActive = timeRemaining > 0;

    return {
      isActive: isActive,
      daysRemaining: Math.max(0, daysRemaining),
      expiresAt: new Date(trialExpiresAt).toISOString().split('T')[0]  // YYYY-MM-DD
    };

  } catch (error) {
    console.error("âŒ Erro ao verificar status do trial:", error);
    return {
      isActive: false,
      daysRemaining: 0,
      expiresAt: null
    };
  }
}

/**
 * Faz login com Google (abre popup)
 */
async function loginWithGoogle() {
  try {
    console.log("ðŸ” Iniciando login com Google...");

    const auth = window.firebaseTEMPLATE.getAuth();
    const provider = new auth.GoogleAuthProvider();

    // Configurar provedor
    provider.addScope('profile');
    provider.addScope('email');

    console.log("ðŸ“± Chamando signInWithPopup...");
    const result = await auth.signInWithPopup(provider);
    console.log("âœ… Login bem-sucedido:", result.user.email);

    // Criar/atualizar usuÃ¡rio no Firestore
    await createOrUpdateUser(result.user);

    return {
      success: true,
      user: result.user
    };

  } catch (error) {
    console.error("âŒ Erro no login:", error);
    return {
      success: false,
      error: error.code || 'unknown',
      message: error.message || 'Erro ao fazer login'
    };
  }
}

/**
 * Cria ou atualiza usuÃ¡rio no Firestore
 */
async function createOrUpdateUser(user) {
  try {
    console.log("ðŸ“ Criando/atualizando usuÃ¡rio no Firestore...");

    const db = window.firebaseTEMPLATE.getDb();
    const userRef = db.collection('users').doc(user.uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      // Criar novo usuÃ¡rio
      console.log("âœ¨ Criando novo usuÃ¡rio...");
      const now = new Date().toISOString();
      await userRef.set({
        email: user.email,
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        createdAt: now,  // Salvar como ISO string para facilitar cÃ¡lculos
        plan: 'free',
        isPro: false,
        features: ['tradutor-ai-limited']
      });

      console.log("âœ… Novo usuÃ¡rio criado no Firestore");
      console.log(`ðŸŽ Trial de ${FREE_TRIAL_DAYS} dias iniciado!`);

      // Verificar ativaÃ§Ãµes pendentes (compras antes do login)
      // TODO: Implementar checkPendingActivations quando Cloud Functions estiver pronta
      // await checkPendingActivations(user.email);
    } else {
      // Atualizar informaÃ§Ãµes
      console.log("ðŸ”„ Atualizando informaÃ§Ãµes do usuÃ¡rio...");
      const now = new Date().toISOString();
      await userRef.update({
        lastLoginAt: now,
        displayName: user.displayName || '',
        photoURL: user.photoURL || ''
      });

      console.log("âœ… InformaÃ§Ãµes do usuÃ¡rio atualizadas");
    }

  } catch (error) {
    console.error("âŒ Erro ao criar/atualizar usuÃ¡rio:", error);
  }
}

/**
 * Verifica ativaÃ§Ãµes pendentes (compras feitas antes do login)
 */
async function checkPendingActivations(email) {
  try {
    console.log("ðŸ” Verificando ativaÃ§Ãµes pendentes...");

    const functions = window.firebaseTEMPLATE.getFunctions();
    const checkPending = functions.httpsCallable('checkPendingActivations');

    const result = await checkPending();

    if (result.data && result.data.activated) {
      console.log("ðŸŽ‰ AtivaÃ§Ã£o pendente processada!");
      console.log("âœ… Plano ativado automaticamente");
      return true;
    }

    console.log("â„¹ï¸ Nenhuma ativaÃ§Ã£o pendente");
    return false;

  } catch (error) {
    console.warn("âš ï¸ Erro ao verificar ativaÃ§Ãµes pendentes:", error);
    // NÃ£o Ã© crÃ­tico, apenas continuar
    return false;
  }
}

/**
 * Verifica uso diário do usuário (para trial gratuito)
 */
async function checkDailyUsage(uid, userData) {
  try {
    const today = new Date().toISOString().split('T')[0];  // YYYY-MM-DD
    const dailyUsage = userData.dailyUsage || { date: '', count: 0 };

    // Se é um novo dia, resetar contador
    if (dailyUsage.date !== today) {
      console.log(`🔄 Novo dia detectado. Resetando contador de trial.`);
      return { date: today, count: 0 };
    }

    console.log(`📊 Uso hoje (${today}): ${dailyUsage.count}/${FREE_TRIAL_DAILY_LIMIT}`);
    return dailyUsage;

  } catch (error) {
    console.error("❌ Erro ao verificar uso diário:", error);
    return { date: '', count: 0 };
  }
}

/**
 * Incrementa contador de uso diário
 */
async function incrementDailyUsage(uid) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const firebaseClient = window.firebaseTEMPLATE;

    // Buscar usuário atual
    const userDoc = await firebaseClient.getDocument(`users/${uid}`);

    if (!userDoc || !userDoc.exists) {
      console.warn("⚠️ Usuário não existe para incrementar uso");
      return false;
    }

    const userData = userDoc.data();
    const dailyUsage = userData.dailyUsage || { date: '', count: 0 };

    // Se é um novo dia, resetar contador
    if (dailyUsage.date !== today) {
      await firebaseClient.updateDocument(`users/${uid}`, {
        dailyUsage: { date: today, count: 1 }
      });
      console.log(`✅ Novo dia: contador resetado e incrementado (1/${FREE_TRIAL_DAILY_LIMIT})`);
    } else {
      // Incrementar contador do dia atual
      const newCount = (dailyUsage.count || 0) + 1;
      await firebaseClient.updateDocument(`users/${uid}`, {
        dailyUsage: { date: today, count: newCount }
      });
      console.log(`✅ Uso incrementado: ${newCount}/${FREE_TRIAL_DAILY_LIMIT} hoje`);
    }

    return true;

  } catch (error) {
    console.error("❌ Erro ao incrementar uso diário:", error);
    return false;
  }
}

/**
 * Faz logout
 */
async function logout() {
  try {
    console.log("ðŸ‘‹ Fazendo logout...");

    const auth = window.firebaseTEMPLATE.getAuth();
    await auth.signOut();

    console.log("âœ… Logout realizado com sucesso");
    return { success: true };

  } catch (error) {
    console.error("âŒ Erro no logout:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * ObtÃ©m usuÃ¡rio atual
 */
function getCurrentUser() {
  const auth = window.firebaseTEMPLATE.getAuth();
  return auth ? auth.currentUser : null;
}

/**
 * Verifica se usuÃ¡rio estÃ¡ autenticado (sÃ­ncrono)
 */
function isAuthenticated() {
  const user = getCurrentUser();
  return user !== null;
}

// Exportar para uso global
window.authTEMPLATE = {
  init: initAuthSystem,
  login: loginWithGoogle,
  logout: logout,
  checkAccess: checkUserAccess,
  incrementUsage: incrementDailyUsage,
  getCurrentUser: getCurrentUser,
  isAuthenticated: isAuthenticated
};

/**
 * Função global para incrementar contador de submissões
 * Usada no content.js para verificar limites de usuários FREE
 */
window.incrementSubmissionCount = async function() {
  try {
    const session = await chrome.storage.local.get('firebase_session');
    const user = session.firebase_session;

    if (!user || !user.uid) {
      console.warn("⚠️ Nenhum usuário logado para incrementar contador");
      return true; // Permitir continuar se não houver sessão
    }

    // Verificar acesso do usuário
    const accessCheck = await checkUserAccess(user.uid);

    // Se usuário não tem acesso, bloquear
    if (!accessCheck.hasAccess) {
      console.error("❌ Usuário sem acesso ao VEO3");
      return false;
    }

    // Se usuário tem plano pago (BÁSICO ou VIP), não há limite
    if (accessCheck.hasAccess && !accessCheck.hasTrial) {
      console.log("✅ Usuário PRO: sem limite de envios");
      return true;
    }

    // Se usuário é FREE com trial ativo, verificar limite diário
    if (accessCheck.hasTrial && accessCheck.isTrialActive) {
      const remaining = accessCheck.remainingSubmissions || 0;

      if (remaining <= 0) {
        console.error("❌ Limite diário de envios atingido (15 envios)");
        return false; // Bloquear envio
      }

      // Incrementar contador
      console.log(`📊 Incrementando contador de uso (${FREE_TRIAL_DAILY_LIMIT - remaining + 1}/${FREE_TRIAL_DAILY_LIMIT})`);
      await incrementDailyUsage(user.uid);
      return true;
    }

    // Usuário FREE sem trial - bloquear
    console.error("❌ Acesso FREE sem trial ativo");
    return false;

  } catch (error) {
    console.error("❌ Erro ao verificar limite de submissões:", error);
    return true; // Em caso de erro, permitir (fail-safe)
  }
};

console.log("âœ… Auth Manager: Pronto!");
