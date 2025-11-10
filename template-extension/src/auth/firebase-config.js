// firebase-config.js - Configuração do Firebase para VEO3 Automator (REST API)
// Desenvolvido por: Nardoto
console.log("🔥 Firebase Config: Carregando...");

// Configuração do Firebase - Nardoto Labs (Sistema Unificado)
const firebaseConfig = {
  apiKey: "AIzaSyBQPGu8l-JQqjHRubcAcYeUK7aIgH7vPIE",
  authDomain: "nardoto-labs.web.app",
  projectId: "tradutor-profissional-ai",
  storageBucket: "tradutor-profissional-ai.firebasestorage.app",
  messagingSenderId: "943297790089",
  appId: "1:943297790089:web:75c2fa533bbe1310d2c658",

  // OAuth Client ID do Google Cloud Console
  // Configurado em: 08/11/2025 (Web Application)
  oauthClientId: "943297790089-kv373d3u95sumiv947in0s57vb6tkho9.apps.googleusercontent.com"
};

// Cliente Firebase simplificado usando REST API
// Isso evita problemas com CSP no Chrome Extension Manifest V3
class FirebaseClient {
  constructor(config) {
    this.config = config;
    this.currentUser = null;
    this.authListeners = [];
    this.initialized = false;
  }

  async initialize() {
    try {
      console.log("🔥 Inicializando Firebase Client...");

      // Tentar recuperar sessão salva
      const savedSession = await this.loadSession();
      if (savedSession) {
        console.log("✅ Sessão salva encontrada");
        this.currentUser = savedSession;
        this.notifyAuthListeners(savedSession);
      } else {
        console.log("ℹ️ Nenhuma sessão salva");
        this.notifyAuthListeners(null);
      }

      this.initialized = true;
      console.log("✅ Firebase Client inicializado");
      return true;

    } catch (error) {
      console.error("❌ Erro ao inicializar Firebase Client:", error);
      return false;
    }
  }

  // Autenticação
  onAuthStateChanged(callback) {
    this.authListeners.push(callback);

    // Se já tem usuário, chamar callback imediatamente
    if (this.currentUser !== undefined) {
      callback(this.currentUser);
    }

    // Retornar função de unsubscribe
    return () => {
      const index = this.authListeners.indexOf(callback);
      if (index > -1) {
        this.authListeners.splice(index, 1);
      }
    };
  }

  notifyAuthListeners(user) {
    this.authListeners.forEach(callback => callback(user));
  }

  async signInWithPopup(provider) {
    try {
      console.log("🔐 Iniciando login via Nardoto Labs...");

      // Abrir popup do Nardoto Labs (usar .web.app até SSL estar pronto)
      const loginUrl = 'https://nardoto-labs.web.app/auth/extension-login.html';
      const popupWindow = window.open(
        loginUrl,
        'Nardoto Labs Login',
        'width=500,height=700,left=100,top=100'
      );

      if (!popupWindow) {
        throw new Error('Popup bloqueado! Permita popups para fazer login.');
      }

      return new Promise((resolve, reject) => {
        // Listener para mensagens do popup
        const messageHandler = async (event) => {
          // Verificar origem (aceita ambos os domínios)
          const allowedOrigins = [
            'https://nardoto-labs.web.app',
            'https://labs.nardoto.com.br'
          ];
          if (!allowedOrigins.includes(event.origin)) {
            return;
          }

          // Verificar tipo de mensagem
          if (event.data?.type === 'NARDOTO_LABS_AUTH') {
            try {
              console.log("✅ Token recebido do Nardoto Labs");

              const { token, user: userData } = event.data;

              // Criar objeto de usuário
              const user = {
                uid: userData.uid,
                email: userData.email,
                displayName: userData.displayName,
                photoURL: userData.photoURL,
                accessToken: token
              };

              // Salvar sessão
              await this.saveSession(user);

              this.currentUser = user;
              this.notifyAuthListeners(user);

              // Fechar popup
              if (popupWindow && !popupWindow.closed) {
                popupWindow.close();
              }

              // Remover listener
              window.removeEventListener('message', messageHandler);

              resolve({ user });

            } catch (error) {
              console.error("❌ Erro ao processar autenticação:", error);
              reject(error);
            }
          }
        };

        // Adicionar listener
        window.addEventListener('message', messageHandler);

        // Timeout de 5 minutos
        setTimeout(() => {
          window.removeEventListener('message', messageHandler);
          if (popupWindow && !popupWindow.closed) {
            popupWindow.close();
          }
          reject(new Error('Timeout: Login não concluído em 5 minutos'));
        }, 5 * 60 * 1000);

        // Verificar se popup foi fechado antes de completar
        const checkClosed = setInterval(() => {
          if (popupWindow.closed) {
            clearInterval(checkClosed);
            window.removeEventListener('message', messageHandler);
            reject(new Error('Login cancelado: popup foi fechado'));
          }
        }, 500);
      });

    } catch (error) {
      console.error("❌ Erro no login:", error);
      throw error;
    }
  }

  async getUserInfo(accessToken) {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Falha ao obter informações do usuário');
    }

    return response.json();
  }

  async exchangeGoogleToken(googleAccessToken, userInfo) {
    try {
      console.log("🔄 Trocando Google access token por Firebase ID token...");

      // Usar Firebase Auth REST API v3 (mais simples, não precisa de API extra habilitada)
      const url = `https://www.googleapis.com/identitytoolkit/v3/relyingparty/verifyAssertion?key=${this.config.apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requestUri: chrome.identity.getRedirectURL(),
          postBody: `access_token=${googleAccessToken}&providerId=google.com`,
          returnSecureToken: true,
          returnIdpCredential: true
        })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("❌ Erro ao trocar token:", error);

        // Se falhar, usar token Google diretamente (menos seguro mas funciona para teste)
        console.warn("⚠️ Usando Google access token diretamente");
        return googleAccessToken;
      }

      const data = await response.json();

      if (data.idToken) {
        console.log("✅ Firebase ID token obtido com sucesso!");
        return data.idToken;
      } else {
        console.warn("⚠️ Resposta sem idToken, usando access token");
        return googleAccessToken;
      }

    } catch (error) {
      console.error("❌ Erro ao trocar Google token por Firebase token:", error);
      console.warn("⚠️ Usando Google access token como fallback");
      return googleAccessToken;
    }
  }

  async signOut() {
    try {
      await chrome.storage.local.remove('firebase_session');
      this.currentUser = null;
      this.notifyAuthListeners(null);
      console.log("✅ Logout realizado");
    } catch (error) {
      console.error("❌ Erro no logout:", error);
      throw error;
    }
  }

  getCurrentUser() {
    return this.currentUser;
  }

  async saveSession(user) {
    await chrome.storage.local.set({
      firebase_session: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        accessToken: user.accessToken,
        savedAt: Date.now()
      }
    });
  }

  async loadSession() {
    try {
      console.log("🔍 DEBUG - loadSession: Buscando no chrome.storage.local...");
      const result = await chrome.storage.local.get('firebase_session');
      const session = result.firebase_session;

      console.log("🔍 DEBUG - loadSession: Sessão encontrada?", !!session);
      if (session) {
        console.log("🔍 DEBUG - loadSession: UID:", session.uid);
        console.log("🔍 DEBUG - loadSession: Email:", session.email);
        console.log("🔍 DEBUG - loadSession: HasToken:", !!session.accessToken);
        console.log("🔍 DEBUG - loadSession: SavedAt:", new Date(session.savedAt));
      }

      if (!session) {
        console.log("ℹ️ DEBUG - loadSession: Nenhuma sessão salva");
        return null;
      }

      // Verificar se sessão não expirou (7 dias)
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - session.savedAt > sevenDays) {
        console.log("⚠️ Sessão expirada");
        await chrome.storage.local.remove('firebase_session');
        return null;
      }

      console.log("✅ DEBUG - loadSession: Sessão válida carregada");
      return {
        uid: session.uid,
        email: session.email,
        displayName: session.displayName,
        photoURL: session.photoURL,
        accessToken: session.accessToken
      };

    } catch (error) {
      console.error("❌ Erro ao carregar sessão:", error);
      return null;
    }
  }

  // Firestore
  async getDocument(path) {
    try {
      console.log("🔍 DEBUG - getDocument:", path);
      console.log("🔍 DEBUG - currentUser:", this.currentUser ? { uid: this.currentUser.uid, hasToken: !!this.currentUser.accessToken } : null);

      const url = `https://firestore.googleapis.com/v1/projects/${this.config.projectId}/databases/(default)/documents/${path}`;

      const headers = {
        'Content-Type': 'application/json'
      };

      // Adicionar token de autenticação se disponível
      if (this.currentUser && this.currentUser.accessToken) {
        headers['Authorization'] = `Bearer ${this.currentUser.accessToken}`;
        console.log("🔍 DEBUG - Token adicionado ao header");
      } else {
        console.warn("⚠️ DEBUG - Sem token! CurrentUser:", this.currentUser);
      }

      console.log("🔍 DEBUG - Fazendo fetch para Firestore...");
      const response = await fetch(url, {
        method: 'GET',
        headers: headers
      });

      console.log("🔍 DEBUG - Response status:", response.status);

      if (!response.ok) {
        if (response.status === 404) {
          console.log("ℹ️ DEBUG - Documento não encontrado (404)");
          return { exists: false };
        }
        const errorText = await response.text();
        console.error("❌ DEBUG - Erro do Firestore:", response.status, errorText);
        throw new Error(`Firestore error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log("✅ DEBUG - Documento encontrado:", Object.keys(data.fields || {}));
      console.log("🔍 DEBUG - Dados RAW do Firestore:", JSON.stringify(data.fields, null, 2));

      const parsedData = this.parseFirestoreDocument(data.fields);
      console.log("✅ DEBUG - Dados parseados:", parsedData);

      return {
        exists: true,
        data: () => parsedData
      };

    } catch (error) {
      console.error("❌ Erro ao buscar documento:", error);
      throw error;
    }
  }

  async setDocument(path, data) {
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${this.config.projectId}/databases/(default)/documents/${path}`;

      const firestoreData = this.toFirestoreFormat(data);

      const headers = {
        'Content-Type': 'application/json'
      };

      // Adicionar token de autenticação se disponível
      if (this.currentUser && this.currentUser.accessToken) {
        headers['Authorization'] = `Bearer ${this.currentUser.accessToken}`;
      }

      const response = await fetch(url, {
        method: 'PATCH',
        headers: headers,
        body: JSON.stringify({ fields: firestoreData })
      });

      if (!response.ok) {
        throw new Error(`Firestore SET error: ${response.status}`);
      }

      console.log(`✅ Documento criado/atualizado: ${path}`);
      return true;

    } catch (error) {
      console.error("❌ Erro ao criar documento:", error);
      throw error;
    }
  }

  async updateDocument(path, data) {
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${this.config.projectId}/databases/(default)/documents/${path}`;

      const firestoreData = this.toFirestoreFormat(data);

      const headers = {
        'Content-Type': 'application/json'
      };

      // Adicionar token de autenticação se disponível
      if (this.currentUser && this.currentUser.accessToken) {
        headers['Authorization'] = `Bearer ${this.currentUser.accessToken}`;
      }

      const response = await fetch(url, {
        method: 'PATCH',
        headers: headers,
        body: JSON.stringify({ fields: firestoreData })
      });

      if (!response.ok) {
        throw new Error(`Firestore UPDATE error: ${response.status}`);
      }

      console.log(`✅ Documento atualizado: ${path}`);
      return true;

    } catch (error) {
      console.error("❌ Erro ao atualizar documento:", error);
      throw error;
    }
  }

  toFirestoreFormat(data) {
    const result = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined) {
        continue;
      }

      if (typeof value === 'string') {
        result[key] = { stringValue: value };
      } else if (typeof value === 'number') {
        result[key] = { integerValue: value };
      } else if (typeof value === 'boolean') {
        result[key] = { booleanValue: value };
      } else if (Array.isArray(value)) {
        result[key] = {
          arrayValue: {
            values: value.map(v => {
              if (typeof v === 'string') return { stringValue: v };
              if (typeof v === 'number') return { integerValue: v };
              if (typeof v === 'boolean') return { booleanValue: v };
              return { stringValue: String(v) };
            })
          }
        };
      } else if (value === 'SERVER_TIMESTAMP') {
        // Usar timestamp atual
        result[key] = { timestampValue: new Date().toISOString() };
      } else if (typeof value === 'object') {
        result[key] = { mapValue: { fields: this.toFirestoreFormat(value) } };
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
}

// Criar instância global
const firebaseClient = new FirebaseClient(firebaseConfig);

// Criar interface compatível com Firebase SDK
const auth = {
  onAuthStateChanged: (callback) => firebaseClient.onAuthStateChanged(callback),
  signInWithPopup: (provider) => firebaseClient.signInWithPopup(provider),
  signOut: () => firebaseClient.signOut(),
  currentUser: null,
  GoogleAuthProvider: class {
    addScope() {}
  }
};

const db = {
  collection: (path) => ({
    doc: (id) => ({
      get: () => firebaseClient.getDocument(`${path}/${id}`),
      set: (data) => firebaseClient.setDocument(`${path}/${id}`, data),
      update: (data) => firebaseClient.updateDocument(`${path}/${id}`, data)
    })
  })
};

// Atualizar currentUser quando mudar
firebaseClient.onAuthStateChanged((user) => {
  auth.currentUser = user;
});

// ⚠️ IMPORTANTE: TROCAR "firebaseTEMPLATE" POR "firebaseSuaExtensao"
// Exemplos: firebaseWisk, firebaseTradutor, firebaseImager
// Este nome deve ser ÚNICO para cada extensão!
window.firebaseTEMPLATE = {
  initialize: () => firebaseClient.initialize(),
  getAuth: () => auth,
  getDb: () => db,
  getDocument: (path) => firebaseClient.getDocument(path),
  updateDocument: (path, data) => firebaseClient.updateDocument(path, data),
  config: firebaseConfig
};

console.log("✅ Firebase Config: Pronto!");
