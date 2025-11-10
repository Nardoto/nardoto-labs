// update-handler.js - Background Service Worker
// Gerencia atualizaÃ§Ãµes e fluxo de autenticaÃ§Ã£o OAuth
// Por Nardoto - Template Extension

console.log("ðŸ“¦ Update Handler: Carregando...");

// Detectar quando a extensÃ£o Ã© instalada ou atualizada
chrome.runtime.onInstalled.addListener((details) => {
  console.log("ðŸ”” Evento de instalaÃ§Ã£o detectado:", details.reason);

  if (details.reason === 'update') {
    const previousVersion = details.previousVersion;
    const currentVersion = chrome.runtime.getManifest().version;

    console.log(`âœ… ExtensÃ£o atualizada de ${previousVersion} para ${currentVersion}`);
    console.log("â„¹ï¸ Novidades da atualizaÃ§Ã£o estÃ£o visÃ­veis no popup de login");

    // NÃ£o abrimos popup separado - as novidades estÃ£o integradas no login
  }
  else if (details.reason === 'install') {
    console.log("ðŸŽ‰ Primeira instalaÃ§Ã£o da extensÃ£o!");
  }
});

// ==========================================
// FLUXO DE AUTENTICAÃ‡ÃƒO OAUTH VIA NARDOTO LABS
// ==========================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("ðŸ“¨ Background: Mensagem recebida:", message.type);

  if (message.type === 'START_LOGIN') {
    handleLogin()
      .then(result => {
        console.log("âœ… Background: Login concluÃ­do com sucesso");
        sendResponse({ success: true, result });
      })
      .catch(error => {
        console.error("âŒ Background: Erro no login:", error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // MantÃ©m o canal aberto para resposta assÃ­ncrona
  }

  if (message.type === 'CHECK_AUTH') {
    checkAuthStatus()
      .then(result => {
        sendResponse({ success: true, result });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });

    return true;
  }
});

async function handleLogin() {
  try {
    console.log("ðŸ” Background: Iniciando fluxo OAuth...");

    // Obter URL de redirect da extensÃ£o
    const redirectUrl = chrome.identity.getRedirectURL();
    console.log("ðŸ”— Background: Redirect URL:", redirectUrl);

    // Construir URL do Nardoto Labs com redirect URL
    const authUrl = `https://nardoto-labs.web.app/auth/extension-login.html?extension=Template%20Extension&redirect=${encodeURIComponent(redirectUrl)}`;
    console.log("ðŸ”— Background: Auth URL:", authUrl);

    // Abrir fluxo OAuth via chrome.identity
    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true
    });

    console.log("âœ… Background: Response URL recebido:", responseUrl);

    // Extrair dados de autenticaÃ§Ã£o da URL de resposta
    const url = new URL(responseUrl);
    const token = url.searchParams.get('token');
    const uid = url.searchParams.get('uid');
    const email = url.searchParams.get('email');
    const displayName = url.searchParams.get('displayName');
    const photoURL = url.searchParams.get('photoURL');

    if (!token || !uid || !email) {
      throw new Error('Dados de autenticaÃ§Ã£o incompletos na resposta');
    }

    // Salvar sessÃ£o no chrome.storage.local
    const sessionData = {
      uid,
      email,
      displayName: displayName || email,
      photoURL: photoURL || '',
      accessToken: token,
      savedAt: Date.now()
    };

    await chrome.storage.local.set({ firebase_session: sessionData });
    console.log("ðŸ’¾ Background: SessÃ£o salva com sucesso");

    return { user: sessionData };

  } catch (error) {
    console.error("âŒ Background: Erro no fluxo OAuth:", error);
    throw error;
  }
}

async function checkAuthStatus() {
  try {
    const result = await chrome.storage.local.get('firebase_session');
    const session = result.firebase_session;

    if (!session) {
      return { authenticated: false };
    }

    // Verificar se sessÃ£o nÃ£o expirou (7 dias)
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - session.savedAt > sevenDays) {
      console.log("âš ï¸ Background: SessÃ£o expirada");
      await chrome.storage.local.remove('firebase_session');
      return { authenticated: false };
    }

    return {
      authenticated: true,
      user: {
        uid: session.uid,
        email: session.email,
        displayName: session.displayName,
        photoURL: session.photoURL
      }
    };
  } catch (error) {
    console.error("âŒ Background: Erro ao verificar autenticaÃ§Ã£o:", error);
    return { authenticated: false };
  }
}

console.log("âœ… Update Handler: Pronto!");
