// ========================================
// EXEMPLO DE INTEGRAÇÃO COM NARDOTO LABS
// Sistema de autenticação centralizada
// ========================================

// Este código deve ser adicionado ao background.js ou service worker da sua extensão Chrome

class NardotoLabsAuth {
    constructor(extensionName) {
        this.extensionName = extensionName;
        this.authUrl = 'https://nardoto-labs.web.app/auth/extension-login.html';
        this.user = null;
        this.token = null;
    }

    // Inicializa o listener para receber o token
    init() {
        // Listener para mensagens da janela de auth
        window.addEventListener('message', (event) => {
            if (event.data.type === 'NARDOTO_LABS_AUTH') {
                this.handleAuthResponse(event.data);
            }
        });

        // Verifica se já tem um token salvo
        this.loadSavedToken();
    }

    // Abre a janela de login
    async login() {
        return new Promise((resolve, reject) => {
            const width = 500;
            const height = 700;
            const left = (screen.width / 2) - (width / 2);
            const top = (screen.height / 2) - (height / 2);

            const authWindow = window.open(
                `${this.authUrl}?extension=${encodeURIComponent(this.extensionName)}`,
                'NardotoLabsAuth',
                `width=${width},height=${height},left=${left},top=${top}`
            );

            // Timeout de 5 minutos
            const timeout = setTimeout(() => {
                if (authWindow && !authWindow.closed) {
                    authWindow.close();
                }
                reject(new Error('Login timeout'));
            }, 5 * 60 * 1000);

            // Listener temporário para esta sessão de login
            const loginListener = (event) => {
                if (event.data.type === 'NARDOTO_LABS_AUTH') {
                    clearTimeout(timeout);
                    window.removeEventListener('message', loginListener);

                    this.handleAuthResponse(event.data);
                    resolve(this.user);
                }
            };

            window.addEventListener('message', loginListener);
        });
    }

    // Processa a resposta do auth
    async handleAuthResponse(data) {
        this.token = data.token;
        this.user = data.user;

        // Salvar no storage da extensão
        await chrome.storage.local.set({
            nardoto_token: this.token,
            nardoto_user: this.user
        });

        console.log('✅ Autenticado com sucesso:', this.user.email);

        // Verificar permissões no backend
        await this.checkPermissions();
    }

    // Carrega token salvo
    async loadSavedToken() {
        const data = await chrome.storage.local.get(['nardoto_token', 'nardoto_user']);

        if (data.nardoto_token && data.nardoto_user) {
            this.token = data.nardoto_token;
            this.user = data.nardoto_user;

            // Verificar se o token ainda é válido
            const valid = await this.checkPermissions();
            if (!valid) {
                this.logout();
            }
        }
    }

    // Verifica permissões do usuário
    async checkPermissions() {
        try {
            // Fazer requisição para Firebase usando o token
            const response = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=AIzaSyBQPGu8l-JQqjHRubcAcYeUK7aIgH7vPIE', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    idToken: this.token
                })
            });

            if (!response.ok) {
                throw new Error('Token inválido');
            }

            const userData = await response.json();
            console.log('✅ Token válido. UID:', userData.users[0].localId);

            // Agora buscar dados do Firestore
            const userDoc = await this.getUserData(userData.users[0].localId);

            return this.hasAccess(userDoc);

        } catch (error) {
            console.error('❌ Erro ao verificar permissões:', error);
            return false;
        }
    }

    // Busca dados do usuário no Firestore
    async getUserData(uid) {
        // Para buscar do Firestore você precisa fazer uma requisição autenticada
        // Ou usar o Firebase SDK diretamente
        const response = await fetch(`https://firestore.googleapis.com/v1/projects/tradutor-profissional-ai/databases/(default)/documents/users/${uid}`, {
            headers: {
                'Authorization': `Bearer ${this.token}`
            }
        });

        if (!response.ok) {
            throw new Error('Erro ao buscar dados do usuário');
        }

        return await response.json();
    }

    // Verifica se o usuário tem acesso à extensão
    hasAccess(userDoc) {
        const features = userDoc.fields?.features?.arrayValue?.values || [];
        const plan = userDoc.fields?.plan?.stringValue || 'free';
        const isPro = userDoc.fields?.isPro?.booleanValue || false;
        const trialExpiresAt = userDoc.fields?.trialExpiresAt?.stringValue;

        // Verifica trial
        if (trialExpiresAt) {
            const trialEnd = new Date(trialExpiresAt);
            if (trialEnd > new Date()) {
                console.log('✅ Trial ativo. Acesso liberado.');
                return true;
            }
        }

        // Verifica plano PRO ou all-features
        if (isPro || features.some(f => f.stringValue === 'all-features')) {
            console.log('✅ Plano PRO. Acesso liberado.');
            return true;
        }

        // Verifica feature específica da extensão
        const extensionFeature = this.getExtensionFeature();
        const hasFeature = features.some(f => f.stringValue === extensionFeature);

        if (hasFeature) {
            console.log(`✅ Feature ${extensionFeature} ativa. Acesso liberado.`);
            return true;
        }

        console.log('❌ Sem permissão para usar esta extensão.');
        return false;
    }

    // Retorna a feature necessária para esta extensão
    getExtensionFeature() {
        const featureMap = {
            'VEO3 Automator': 'veo3-automator',
            'Wisk Automator': 'wisk-automator',
            'Tradutor AI Ilimitado': 'tradutor-ai-unlimited'
        };

        return featureMap[this.extensionName] || 'unknown';
    }

    // Logout
    async logout() {
        this.token = null;
        this.user = null;
        await chrome.storage.local.remove(['nardoto_token', 'nardoto_user']);
        console.log('🚪 Logout realizado');
    }

    // Verifica se está autenticado
    isAuthenticated() {
        return this.token !== null && this.user !== null;
    }

    // Obtém dados do usuário
    getUser() {
        return this.user;
    }
}

// ========================================
// EXEMPLO DE USO NA EXTENSÃO
// ========================================

// Inicializar o sistema de auth
const auth = new NardotoLabsAuth('VEO3 Automator'); // Trocar pelo nome da sua extensão
auth.init();

// Exemplo: Verificar auth ao abrir popup
chrome.action.onClicked.addListener(async () => {
    if (!auth.isAuthenticated()) {
        console.log('⚠️ Usuário não autenticado. Abrindo tela de login...');

        try {
            const user = await auth.login();
            console.log('✅ Login bem-sucedido:', user.email);
        } catch (error) {
            console.error('❌ Erro no login:', error);
        }
    } else {
        // Verificar permissões antes de executar qualquer ação
        const hasPermission = await auth.checkPermissions();

        if (hasPermission) {
            console.log('✅ Permissão verificada. Executando funcionalidade...');
            // Executar a funcionalidade da extensão
        } else {
            console.log('❌ Sem permissão. Redirecionando para upgrade...');
            window.open('https://nardoto-labs.web.app/dashboard.html', '_blank');
        }
    }
});

// ========================================
// INTEGRAÇÃO COM MANIFEST V3
// ========================================

/*
No manifest.json da sua extensão, adicione:

{
  "manifest_version": 3,
  "name": "VEO3 Automator",
  "version": "1.0.0",
  "permissions": [
    "storage",
    "tabs"
  ],
  "host_permissions": [
    "https://nardoto-labs.web.app/*",
    "https://identitytoolkit.googleapis.com/*",
    "https://firestore.googleapis.com/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
*/
