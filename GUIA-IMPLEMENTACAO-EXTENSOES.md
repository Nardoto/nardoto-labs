# 🚀 Guia de Implementação - Autenticação Nardoto Labs

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura do Sistema](#arquitetura-do-sistema)
3. [Arquivos Necessários](#arquivos-necessários)
4. [Passo a Passo da Implementação](#passo-a-passo-da-implementação)
5. [Configuração do Firestore](#configuração-do-firestore)
6. [Testes e Validação](#testes-e-validação)
7. [Troubleshooting](#troubleshooting)

---

## 📊 Visão Geral

Este guia explica como integrar **qualquer Chrome Extension** ao sistema de autenticação centralizada do **Nardoto Labs**.

### Benefícios da Integração:
- ✅ Login único (SSO) para todas as extensões
- ✅ Gerenciamento de planos centralizado (FREE, BÁSICO, VIP)
- ✅ Trial de 3 dias automático para usuários FREE
- ✅ Webhook Kiwify para ativação automática de assinaturas
- ✅ Admin panel para gestão manual de usuários
- ✅ Distribuição direta (sem Chrome Web Store)

---

## 🏗️ Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────┐
│                   Nardoto Labs (Firebase)               │
│  - Firestore: users collection                          │
│  - Hosting: dashboard, admin, extension-login           │
│  - Functions: kiwifyWebhook                             │
└─────────────────────────────────────────────────────────┘
                            ▲
                            │ OAuth Flow
                            │
┌───────────────────────────┼─────────────────────────────┐
│      Chrome Extension     │                             │
│                           ▼                             │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Background Script (update-handler.js)          │   │
│  │  - chrome.identity.launchWebAuthFlow()         │   │
│  │  - Recebe token + uid + email                  │   │
│  │  - Salva em chrome.storage.local               │   │
│  └─────────────────────────────────────────────────┘   │
│                           │                             │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Firebase Config (firebase-config.js)           │   │
│  │  - REST API para Firestore                     │   │
│  │  - Lê sessão do chrome.storage.local           │   │
│  └─────────────────────────────────────────────────┘   │
│                           │                             │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Auth Manager (auth-manager.js)                 │   │
│  │  - checkUserAccess(uid)                        │   │
│  │  - Verifica plano, features, trial             │   │
│  │  - incrementSubmissionCount()                  │   │
│  └─────────────────────────────────────────────────┘   │
│                           │                             │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Content Script (content.js)                    │   │
│  │  - Injeta UI de login/logout                   │   │
│  │  - Verifica acesso antes de executar           │   │
│  │  - Chama automação se tiver acesso             │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 Arquivos Necessários

### 1. **manifest.json** (Configuração da Extensão)

```json
{
  "manifest_version": 3,
  "name": "Sua Extensão",
  "version": "1.0.0",
  "permissions": [
    "storage",
    "identity"
  ],
  "host_permissions": [
    "https://firestore.googleapis.com/*",
    "https://*.firebaseapp.com/*"
  ],
  "background": {
    "service_worker": "src/background/update-handler.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["https://seusite.com/*"],
      "js": [
        "src/auth/firebase-config.js",
        "src/auth/auth-manager.js",
        "src/core/content.js"
      ],
      "run_at": "document_idle"
    }
  ],
  "web_accessible_resources": [
    {
      "resources": ["src/auth/*"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

### 2. **src/auth/firebase-config.js** (Cliente Firebase REST API)

```javascript
// firebase-config.js - Cliente REST para Firestore (Manifest V3)
console.log("🔥 Firebase Config: Carregando...");

const firebaseConfig = {
  apiKey: "AIzaSyBQPGu8l-JQqjHRubcAcYeUK7aIgH7vPIE",
  authDomain: "nardoto-labs.web.app",
  projectId: "tradutor-profissional-ai",
  storageBucket: "tradutor-profissional-ai.firebasestorage.app",
  messagingSenderId: "943297790089",
  appId: "1:943297790089:web:75c2fa533bbe1310d2c658"
};

class FirebaseClient {
  constructor(config) {
    this.config = config;
    this.currentUser = null;
    this.authStateCallbacks = [];
  }

  async initialize() {
    console.log("🔥 Inicializando Firebase REST Client...");
    try {
      await this.loadSession();
      console.log("✅ Firebase inicializado com sucesso");
      return true;
    } catch (error) {
      console.error("❌ Erro ao inicializar Firebase:", error);
      return false;
    }
  }

  async loadSession() {
    try {
      const result = await chrome.storage.local.get('firebase_session');
      const session = result.firebase_session;

      if (session && session.uid) {
        this.currentUser = {
          uid: session.uid,
          email: session.email,
          displayName: session.displayName,
          photoURL: session.photoURL
        };

        // Notificar callbacks
        this.authStateCallbacks.forEach(callback => {
          try { callback(this.currentUser); } catch (e) {}
        });
      }

      return !!this.currentUser;
    } catch (error) {
      console.error("❌ Erro ao carregar sessão:", error);
      return false;
    }
  }

  onAuthStateChanged(callback) {
    this.authStateCallbacks.push(callback);

    // Chamar imediatamente com estado atual
    if (this.currentUser) {
      callback(this.currentUser);
    } else {
      callback(null);
    }

    return () => {
      const index = this.authStateCallbacks.indexOf(callback);
      if (index > -1) this.authStateCallbacks.splice(index, 1);
    };
  }

  async getDocument(path) {
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${this.config.projectId}/databases/(default)/documents/${path}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return { exists: false, data: () => null };
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const parsedData = this.parseFirestoreDocument(data.fields);

      return {
        exists: true,
        data: () => parsedData
      };
    } catch (error) {
      console.error("❌ Erro ao buscar documento:", error);
      throw error;
    }
  }

  async updateDocument(path, data) {
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${this.config.projectId}/databases/(default)/documents/${path}`;

      const firestoreData = this.toFirestoreFormat(data);

      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: firestoreData })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error("❌ Erro ao atualizar documento:", error);
      throw error;
    }
  }

  toFirestoreFormat(obj) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        result[key] = { stringValue: value };
      } else if (typeof value === 'number') {
        result[key] = { integerValue: value };
      } else if (typeof value === 'boolean') {
        result[key] = { booleanValue: value };
      } else if (Array.isArray(value)) {
        result[key] = {
          arrayValue: {
            values: value.map(v => ({ stringValue: String(v) }))
          }
        };
      } else if (typeof value === 'object' && value !== null) {
        result[key] = {
          mapValue: {
            fields: this.toFirestoreFormat(value)
          }
        };
      }
    }
    return result;
  }

  parseFirestoreDocument(fields) {
    if (!fields) return {};

    const result = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value.stringValue !== undefined) {
        result[key] = value.stringValue;
      } else if (value.integerValue !== undefined) {
        result[key] = parseInt(value.integerValue);
      } else if (value.booleanValue !== undefined) {
        result[key] = value.booleanValue;
      } else if (value.arrayValue) {
        result[key] = (value.arrayValue.values || []).map(v =>
          v.stringValue || v.integerValue || v.booleanValue
        );
      } else if (value.mapValue) {
        result[key] = this.parseFirestoreDocument(value.mapValue.fields);
      }
    }
    return result;
  }

  async signOut() {
    await chrome.storage.local.remove('firebase_session');
    this.currentUser = null;
    this.authStateCallbacks.forEach(callback => {
      try { callback(null); } catch (e) {}
    });
  }

  getAuth() {
    return {
      currentUser: this.currentUser,
      onAuthStateChanged: (callback) => this.onAuthStateChanged(callback),
      signOut: () => this.signOut()
    };
  }

  getDb() {
    return {
      collection: (path) => ({
        doc: (id) => ({
          get: () => this.getDocument(`${path}/${id}`),
          update: (data) => this.updateDocument(`${path}/${id}`, data)
        })
      })
    };
  }
}

// Criar instância global
const firebaseClient = new FirebaseClient(firebaseConfig);

// Exportar para uso global
window.firebaseYourExtension = {
  initialize: () => firebaseClient.initialize(),
  getAuth: () => firebaseClient.getAuth(),
  getDb: () => firebaseClient.getDb(),
  getDocument: (path) => firebaseClient.getDocument(path),
  updateDocument: (path, data) => firebaseClient.updateDocument(path, data),
  config: firebaseConfig
};

console.log("✅ Firebase Config: Pronto!");
```

**⚠️ IMPORTANTE:** Altere `window.firebaseYourExtension` para um nome único da sua extensão!

### 3. **src/auth/auth-manager.js** (Gerenciador de Autenticação)

```javascript
// auth-manager.js - Sistema de Autenticação
console.log("🔐 Auth Manager: Carregando...");

// ⚠️ CONFIGURAÇÃO - ALTERE ESTES VALORES PARA SUA EXTENSÃO
const EXTENSION_ID = 'sua-extensao-id';  // Ex: 'wisk-automator', 'tradutor-ai-unlimited'
const REQUIRED_PLANS = ['basic', 'vip'];  // Quais planos têm acesso
const FREE_TRIAL_DAYS = 3;
const FREE_TRIAL_DAILY_LIMIT = 15;

async function initAuthSystem() {
  console.log("🔐 Inicializando sistema de autenticação...");

  try {
    const firebaseReady = await window.firebaseYourExtension.initialize();
    if (!firebaseReady) {
      return {
        success: false,
        isAuthenticated: false,
        hasAccess: false,
        message: "Erro ao conectar com servidor de autenticação"
      };
    }

    const auth = window.firebaseYourExtension.getAuth();

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

        if (user) {
          const accessCheck = await checkUserAccess(user.uid);

          resolveOnce({
            success: true,
            isAuthenticated: true,
            hasAccess: accessCheck.hasAccess,
            plan: accessCheck.plan,
            features: accessCheck.features,
            user: {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL
            },
            hasTrial: accessCheck.hasTrial || false,
            isTrialActive: accessCheck.isTrialActive || false,
            trialDaysRemaining: accessCheck.trialDaysRemaining || -1,
            trialExpiresAt: accessCheck.trialExpiresAt || null,
            dailyLimit: accessCheck.dailyLimit || null,
            remainingSubmissions: accessCheck.remainingSubmissions || null,
            message: accessCheck.message
          });
        } else {
          resolveOnce({
            success: true,
            isAuthenticated: false,
            hasAccess: false,
            message: "Não autenticado"
          });
        }
      });

      setTimeout(() => {
        resolveOnce({
          success: false,
          isAuthenticated: false,
          hasAccess: false,
          message: "Timeout ao verificar autenticação"
        });
      }, 10000);
    });

  } catch (error) {
    console.error("❌ Erro ao inicializar autenticação:", error);
    return {
      success: false,
      isAuthenticated: false,
      hasAccess: false,
      plan: 'free',
      features: [],
      message: "Erro ao verificar autenticação"
    };
  }
}

async function checkUserAccess(uid) {
  try {
    console.log("🔍 Verificando acesso do usuário no Firestore...");

    const db = window.firebaseYourExtension.getDb();
    const userDoc = await db.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      console.warn("⚠️ Usuário não encontrado no Firestore");
      return {
        hasAccess: false,
        plan: 'free',
        features: [],
        message: "Usuário não encontrado. Faça login no dashboard primeiro."
      };
    }

    const userData = userDoc.data();
    const userPlan = userData.plan || 'free';
    const features = userData.features || [];

    console.log(`📋 Plano: ${userPlan}`);
    console.log(`🎯 Features:`, features);
    console.log(`📦 isPro: ${userData.isPro}`);

    // Verificar se tem acesso
    const hasAccess =
      features.includes(EXTENSION_ID) ||
      features.includes('all-features') ||
      REQUIRED_PLANS.includes(userPlan);

    if (hasAccess) {
      console.log("✅ Usuário TEM acesso!");
      return {
        hasAccess: true,
        plan: userPlan,
        features: features,
        message: `Bem-vindo! Plano ${userPlan.toUpperCase()} ativo`,
        userData: userData,
        hasTrial: false,
        trialDaysRemaining: -1,
        trialExpiresAt: null
      };
    } else {
      // Usuário FREE - verificar trial
      console.log("💡 Usuário FREE - Verificando trial...");

      const trialStatus = checkTrialStatus(userData);

      if (trialStatus.isActive) {
        const dailyUsage = await checkDailyUsage(uid, userData);
        const remainingSubmissions = FREE_TRIAL_DAILY_LIMIT - (dailyUsage.count || 0);

        console.log(`✅ Trial ativo: ${trialStatus.daysRemaining} dias restantes`);

        return {
          hasAccess: true,
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
        console.log("❌ Trial expirado");
        return {
          hasAccess: false,
          plan: userPlan,
          features: features,
          message: `Trial de 3 dias expirado. Faça upgrade para BÁSICO ou VIP!`,
          userData: userData,
          hasTrial: true,
          trialDaysRemaining: 0,
          trialExpiresAt: trialStatus.expiresAt
        };
      }
    }

  } catch (error) {
    console.error("❌ Erro ao verificar acesso:", error);
    return {
      hasAccess: false,
      plan: 'free',
      features: [],
      message: "Erro ao verificar acesso"
    };
  }
}

function checkTrialStatus(userData) {
  try {
    const createdAt = userData.createdAt;

    if (!createdAt) {
      return {
        isActive: false,
        daysRemaining: 0,
        expiresAt: null
      };
    }

    let createdTimestamp;
    if (typeof createdAt === 'string') {
      createdTimestamp = new Date(createdAt).getTime();
    } else if (createdAt._seconds) {
      createdTimestamp = createdAt._seconds * 1000;
    } else {
      createdTimestamp = createdAt;
    }

    const now = Date.now();
    const trialDurationMs = FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000;
    const trialExpiresAt = createdTimestamp + trialDurationMs;
    const timeRemaining = trialExpiresAt - now;
    const daysRemaining = Math.ceil(timeRemaining / (24 * 60 * 60 * 1000));

    const isActive = timeRemaining > 0;

    return {
      isActive: isActive,
      daysRemaining: Math.max(0, daysRemaining),
      expiresAt: new Date(trialExpiresAt).toISOString().split('T')[0]
    };

  } catch (error) {
    console.error("❌ Erro ao verificar trial:", error);
    return {
      isActive: false,
      daysRemaining: 0,
      expiresAt: null
    };
  }
}

async function checkDailyUsage(uid, userData) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const dailyUsage = userData.dailyUsage || { date: '', count: 0 };

    if (dailyUsage.date !== today) {
      return { date: today, count: 0 };
    }

    return dailyUsage;

  } catch (error) {
    console.error("❌ Erro ao verificar uso diário:", error);
    return { date: '', count: 0 };
  }
}

async function incrementDailyUsage(uid) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const firebaseClient = window.firebaseYourExtension;

    const userDoc = await firebaseClient.getDocument(`users/${uid}`);

    if (!userDoc || !userDoc.exists) {
      console.warn("⚠️ Usuário não existe");
      return false;
    }

    const userData = userDoc.data();
    const dailyUsage = userData.dailyUsage || { date: '', count: 0 };

    if (dailyUsage.date !== today) {
      await firebaseClient.updateDocument(`users/${uid}`, {
        dailyUsage: { date: today, count: 1 }
      });
      console.log(`✅ Novo dia: contador resetado (1/${FREE_TRIAL_DAILY_LIMIT})`);
    } else {
      const newCount = (dailyUsage.count || 0) + 1;
      await firebaseClient.updateDocument(`users/${uid}`, {
        dailyUsage: { date: today, count: newCount }
      });
      console.log(`✅ Uso incrementado: ${newCount}/${FREE_TRIAL_DAILY_LIMIT}`);
    }

    return true;

  } catch (error) {
    console.error("❌ Erro ao incrementar uso:", error);
    return false;
  }
}

async function logout() {
  try {
    console.log("👋 Fazendo logout...");
    const auth = window.firebaseYourExtension.getAuth();
    await auth.signOut();
    console.log("✅ Logout realizado");
    return { success: true };
  } catch (error) {
    console.error("❌ Erro no logout:", error);
    return { success: false, error: error.message };
  }
}

// Exportar para uso global
window.authYourExtension = {
  init: initAuthSystem,
  logout: logout,
  checkAccess: checkUserAccess
};

// Função global para incrementar contador
window.incrementSubmissionCount = async function() {
  try {
    const session = await chrome.storage.local.get('firebase_session');
    const user = session.firebase_session;

    if (!user || !user.uid) {
      console.warn("⚠️ Nenhum usuário logado");
      return true;
    }

    const accessCheck = await checkUserAccess(user.uid);

    if (!accessCheck.hasAccess) {
      console.error("❌ Usuário sem acesso");
      return false;
    }

    // Planos pagos: sem limite
    if (accessCheck.hasAccess && !accessCheck.hasTrial) {
      console.log("✅ Usuário PRO: sem limite");
      return true;
    }

    // Trial: verificar limite
    if (accessCheck.hasTrial && accessCheck.isTrialActive) {
      const remaining = accessCheck.remainingSubmissions || 0;

      if (remaining <= 0) {
        console.error("❌ Limite diário atingido");
        return false;
      }

      await incrementDailyUsage(user.uid);
      return true;
    }

    console.error("❌ Acesso FREE sem trial");
    return false;

  } catch (error) {
    console.error("❌ Erro ao verificar limite:", error);
    return true; // Fail-safe
  }
};

console.log("✅ Auth Manager: Pronto!");
```

**⚠️ IMPORTANTE:** Altere as constantes no topo:
- `EXTENSION_ID`: ID único da extensão
- `window.firebaseYourExtension`: mesmo nome usado no firebase-config.js
- `window.authYourExtension`: nome único do auth manager

### 4. **src/background/update-handler.js** (Background Service Worker)

```javascript
// update-handler.js - Background script para OAuth flow
console.log("🔧 Background: Iniciando...");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("📨 Background: Mensagem recebida:", message.type);

  if (message.type === 'START_LOGIN') {
    handleLogin()
      .then(result => {
        console.log("✅ Background: Login concluído");
        sendResponse({ success: true, result });
      })
      .catch(error => {
        console.error("❌ Background: Erro no login:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Importante: mantém o canal aberto
  }
});

async function handleLogin() {
  try {
    console.log("🔐 Iniciando OAuth flow...");

    const redirectUrl = chrome.identity.getRedirectURL();
    console.log("🔗 Redirect URL:", redirectUrl);

    const authUrl = `https://nardoto-labs.web.app/auth/extension-login.html?extension=Sua%20Extensão&redirect=${encodeURIComponent(redirectUrl)}`;

    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true
    });

    console.log("✅ OAuth response recebido");

    const url = new URL(responseUrl);
    const token = url.searchParams.get('token');
    const uid = url.searchParams.get('uid');
    const email = url.searchParams.get('email');
    const displayName = url.searchParams.get('displayName');
    const photoURL = url.searchParams.get('photoURL');

    if (!uid || !email) {
      throw new Error('Dados de autenticação incompletos');
    }

    const sessionData = {
      uid,
      email,
      displayName: displayName || email,
      photoURL: photoURL || '',
      accessToken: token,
      savedAt: Date.now()
    };

    await chrome.storage.local.set({ firebase_session: sessionData });
    console.log("✅ Sessão salva com sucesso");

    return { user: sessionData };

  } catch (error) {
    console.error("❌ Erro no login:", error);
    throw error;
  }
}

console.log("✅ Background: Pronto!");
```

### 5. **src/core/content.js** (Content Script com UI)

```javascript
// content.js - Script principal da extensão
console.log("🚀 Extensão: Carregando...");

let authStatus = null;

// Inicializar sistema de autenticação
async function initializeExtension() {
  try {
    console.log("🔐 Inicializando autenticação...");

    authStatus = await window.authYourExtension.init();

    console.log("📊 Status de autenticação:", authStatus);

    // Injetar UI de autenticação
    injectAuthUI();

    // Se tiver acesso, executar funcionalidade principal
    if (authStatus.hasAccess) {
      console.log("✅ Acesso autorizado - Executando extensão");
      // AQUI VAI A LÓGICA DA SUA EXTENSÃO
      executeMainFunctionality();
    } else {
      console.log("🔒 Sem acesso - Mostrando mensagem");
      showAccessDeniedMessage(authStatus.message);
    }

  } catch (error) {
    console.error("❌ Erro ao inicializar:", error);
  }
}

// Injetar UI de login/logout
function injectAuthUI() {
  const container = document.createElement('div');
  container.id = 'nardoto-auth-ui';
  container.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 999999;
    background: white;
    padding: 15px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  if (authStatus.isAuthenticated) {
    // Mostrar info do usuário + logout
    container.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <img src="${authStatus.user.photoURL || ''}"
             style="width: 32px; height: 32px; border-radius: 50%;" />
        <div>
          <div style="font-weight: 600; font-size: 14px;">${authStatus.user.displayName}</div>
          <div style="font-size: 12px; color: #666;">
            ${authStatus.plan.toUpperCase()}
            ${authStatus.hasTrial ? ` - ${authStatus.trialDaysRemaining} dias` : ''}
          </div>
        </div>
        <button id="logoutBtn" style="
          background: #dc3545;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        ">Sair</button>
      </div>
    `;

    document.body.appendChild(container);

    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await window.authYourExtension.logout();
      location.reload();
    });

  } else {
    // Mostrar botão de login
    container.innerHTML = `
      <button id="loginBtn" style="
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
        font-size: 14px;
      ">🔐 Fazer Login</button>
    `;

    document.body.appendChild(container);

    document.getElementById('loginBtn').addEventListener('click', async () => {
      try {
        document.getElementById('loginBtn').disabled = true;
        document.getElementById('loginBtn').textContent = 'Conectando...';

        const response = await chrome.runtime.sendMessage({ type: 'START_LOGIN' });

        if (response.success) {
          console.log('✅ Login realizado');
          setTimeout(() => location.reload(), 300);
        } else {
          throw new Error(response.error || 'Erro no login');
        }
      } catch (error) {
        console.error('❌ Erro ao fazer login:', error);
        alert('Erro ao fazer login. Tente novamente.');
        document.getElementById('loginBtn').disabled = false;
        document.getElementById('loginBtn').textContent = '🔐 Fazer Login';
      }
    });
  }
}

function showAccessDeniedMessage(message) {
  const banner = document.createElement('div');
  banner.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    z-index: 999998;
    background: #fff3cd;
    border: 2px solid #ffc107;
    color: #856404;
    padding: 20px;
    border-radius: 8px;
    max-width: 400px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  banner.innerHTML = `
    <h3 style="margin: 0 0 10px 0; font-size: 16px;">🔒 Acesso Bloqueado</h3>
    <p style="margin: 0 0 15px 0; font-size: 14px;">${message}</p>
    <a href="https://nardoto-labs.web.app/dashboard.html"
       target="_blank"
       style="
         display: inline-block;
         background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
         color: white;
         text-decoration: none;
         padding: 10px 20px;
         border-radius: 6px;
         font-weight: 600;
         font-size: 14px;
       ">
      💎 Ver Planos
    </a>
  `;

  document.body.appendChild(banner);
}

// SUBSTITUIR PELA LÓGICA DA SUA EXTENSÃO
async function executeMainFunctionality() {
  console.log("🎯 Executando funcionalidade principal da extensão...");

  // Exemplo: verificar limite antes de executar ação
  const canContinue = await window.incrementSubmissionCount();

  if (!canContinue) {
    console.error("❌ Limite de envios atingido");
    alert("Limite diário de envios atingido! Faça upgrade para continuar.");
    return;
  }

  // AQUI VAI O CÓDIGO DA SUA EXTENSÃO
  // Ex: manipular DOM, fazer requests, etc

  console.log("✅ Funcionalidade executada com sucesso!");
}

// Inicializar quando página carregar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
}

console.log("✅ Extensão: Pronta!");
```

---

## 🔥 Passo a Passo da Implementação

### Passo 1: Criar Estrutura de Pastas

```
sua-extensao/
├── manifest.json
├── src/
│   ├── auth/
│   │   ├── firebase-config.js
│   │   └── auth-manager.js
│   ├── background/
│   │   └── update-handler.js
│   └── core/
│       └── content.js
└── README.md
```

### Passo 2: Copiar e Adaptar os Arquivos

1. **Copie os 5 arquivos** mostrados acima para sua extensão
2. **Substitua os placeholders:**
   - `EXTENSION_ID` → ID único da extensão (ex: `wisk-automator`)
   - `window.firebaseYourExtension` → Nome único (ex: `window.firebaseWisk`)
   - `window.authYourExtension` → Nome único (ex: `window.authWisk`)
   - `"Sua Extensão"` → Nome real da extensão
   - `https://seusite.com/*` → URL onde a extensão funciona

### Passo 3: Adicionar Permissões no Manifest

```json
{
  "permissions": [
    "storage",
    "identity"
  ],
  "host_permissions": [
    "https://firestore.googleapis.com/*",
    "https://*.firebaseapp.com/*",
    "https://seusite.com/*"
  ]
}
```

### Passo 4: Testar Localmente

1. Abra `chrome://extensions/`
2. Ative "Modo do desenvolvedor"
3. Clique em "Carregar sem compactação"
4. Selecione a pasta da extensão
5. Navegue até o site alvo
6. Clique em "Fazer Login"
7. Faça login com Google
8. Verifique console: deve mostrar "✅ Acesso autorizado"

---

## 🔥 Configuração do Firestore

### 1. Adicionar Extensão aos Planos

Os planos são definidos pelos campos `plan` e `features` no documento do usuário:

```javascript
// users/{uid}
{
  email: "user@example.com",
  plan: "free",        // ou "basic", "vip"
  isPro: false,        // true para basic/vip
  features: [],        // array de extension IDs
  createdAt: "2025-01-10...",
  lastLogin: "2025-01-10..."
}
```

### 2. Features por Plano

| Plano | features | isPro | Descrição |
|-------|----------|-------|-----------|
| **FREE** | `[]` | `false` | Trial de 3 dias |
| **BÁSICO** | `['veo3-automator', 'wisk-automator', 'tradutor-ai-unlimited']` | `true` | 3 extensões específicas |
| **VIP** | `['all-features']` | `true` | Todas as extensões |

### 3. Adicionar Nova Extensão ao Sistema

**Opção A - VIP (all-features):**
- Nada a fazer! VIP já tem acesso

**Opção B - BÁSICO (extensões específicas):**
1. Adicione o `EXTENSION_ID` ao array `features` dos usuários BÁSICO
2. Exemplo via admin panel:
   ```javascript
   features: ['veo3-automator', 'wisk-automator', 'tradutor-ai-unlimited', 'sua-nova-extensao']
   ```

**Opção C - Extensão Premium Exclusiva:**
1. Crie novo plano no Kiwify
2. Configure webhook para adicionar feature específica
3. Defina `REQUIRED_PLANS` no auth-manager.js

---

## ✅ Testes e Validação

### Checklist de Testes

- [ ] **Login funciona** - Botão abre popup e salva sessão
- [ ] **Usuário FREE sem trial** - Mostra mensagem de bloqueio
- [ ] **Usuário FREE com trial** - Tem acesso limitado (15 envios/dia)
- [ ] **Usuário BÁSICO** - Tem acesso se extensão está em `features`
- [ ] **Usuário VIP** - Tem acesso ilimitado
- [ ] **Logout funciona** - Remove sessão e recarrega
- [ ] **Contador de envios** - Incrementa no Firestore
- [ ] **Limite diário** - Bloqueia após 15 envios (trial)
- [ ] **UI de autenticação** - Aparece no canto superior direito
- [ ] **Mensagem de upgrade** - Mostra link para dashboard

### Console Logs Esperados

**Login bem-sucedido (VIP):**
```
🔥 Firebase Config: Carregando...
✅ Firebase Config: Pronto!
🔐 Auth Manager: Carregando...
✅ Auth Manager: Pronto!
🚀 Extensão: Carregando...
🔐 Inicializando autenticação...
🔍 Verificando acesso do usuário no Firestore...
📋 Plano: vip
🎯 Features: ['all-features']
📦 isPro: true
✅ Usuário TEM acesso!
✅ Acesso autorizado - Executando extensão
🎯 Executando funcionalidade principal da extensão...
✅ Funcionalidade executada com sucesso!
```

**Login bem-sucedido (FREE com trial):**
```
🔍 Verificando acesso do usuário no Firestore...
📋 Plano: free
💡 Usuário FREE - Verificando trial...
✅ Trial ativo: 2 dias restantes
📊 Uso hoje: 0/15 envios
✅ Acesso autorizado - Executando extensão
📊 Incrementando contador de uso (1/15)
✅ Uso incrementado: 1/15 hoje
```

---

## 🔧 Troubleshooting

### Erro: "Cannot read properties of undefined (reading 'initialize')"

**Causa:** `window.firebaseYourExtension` não está definido
**Solução:**
1. Verifique se `firebase-config.js` está carregando ANTES de `auth-manager.js`
2. Verifique se os nomes batem (firebase-config e auth-manager usam mesmo nome)

### Erro: "User not found in Firestore"

**Causa:** Usuário não foi criado no primeiro login
**Solução:**
1. Faça login pelo dashboard primeiro: [https://nardoto-labs.web.app/dashboard.html](https://nardoto-labs.web.app/dashboard.html)
2. Depois use a extensão

### Erro: "chrome.identity.launchWebAuthFlow is not a function"

**Causa:** Tentou chamar chrome.identity de content script
**Solução:** Certifique-se que está chamando via background script (update-handler.js)

### Banner de upgrade não aparece

**Causa:** Lógica do banner está bloqueando
**Solução:**
```javascript
// Em dashboard.html, linha ~381
if (!userData.isPro) {
  document.getElementById('upgradeBanner').style.display = 'block';
}
```

### Sessão não persiste após reload

**Causa:** `chrome.storage.local` não está salvando
**Solução:**
1. Adicione permissão `"storage"` no manifest.json
2. Verifique console do background script

---

## 📚 Referências

- **Dashboard:** [https://nardoto-labs.web.app/dashboard.html](https://nardoto-labs.web.app/dashboard.html)
- **Admin Panel:** [https://nardoto-labs.web.app/admin.html](https://nardoto-labs.web.app/admin.html)
- **Extension Login:** [https://nardoto-labs.web.app/auth/extension-login.html](https://nardoto-labs.web.app/auth/extension-login.html)
- **Firestore Console:** [https://console.firebase.google.com/project/tradutor-profissional-ai/firestore](https://console.firebase.google.com/project/tradutor-profissional-ai/firestore)

---

## 🎯 Resumo dos IDs Únicos

| Arquivo | Variável | Exemplo |
|---------|----------|---------|
| firebase-config.js | `window.firebaseXXX` | `window.firebaseWisk` |
| auth-manager.js | `window.authXXX` | `window.authWisk` |
| auth-manager.js | `EXTENSION_ID` | `'wisk-automator'` |
| content.js | Referências | Usar mesmos nomes acima |

**⚠️ REGRA DE OURO:** Cada extensão precisa de nomes únicos para evitar conflitos!

---

**Desenvolvido por:** Nardoto
**Sistema:** Nardoto Labs
**Versão:** 1.0.0
**Data:** Janeiro 2025
