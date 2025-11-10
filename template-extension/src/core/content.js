// content.js - Script principal da extensão
// ⚠️ IMPORTANTE: Trocar "window.authTEMPLATE" pelo nome da sua extensão
console.log("🚀 Extensão: Carregando...");

let authStatus = null;

// Inicializar sistema de autenticação
async function initializeExtension() {
  try {
    console.log("🔐 Inicializando autenticação...");

    // ⚠️ TROCAR: authTEMPLATE → authSuaExtensao
    authStatus = await window.authTEMPLATE.init();

    console.log("📊 Status de autenticação:", authStatus);

    // Injetar UI de autenticação
    injectAuthUI();

    // Se tiver acesso, executar funcionalidade principal
    if (authStatus.hasAccess) {
      console.log("✅ Acesso autorizado - Executando extensão");
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
      // ⚠️ TROCAR: authTEMPLATE → authSuaExtensao
      await window.authTEMPLATE.logout();
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

// ═══════════════════════════════════════════════════════════════════
// ⚠️ ADICIONE A LÓGICA DA SUA EXTENSÃO AQUI
// ═══════════════════════════════════════════════════════════════════
async function executeMainFunctionality() {
  console.log("🎯 Executando funcionalidade principal da extensão...");

  // Verificar limite antes de executar ação (opcional, apenas para trial/free)
  if (authStatus.hasTrial && authStatus.isTrialActive) {
    const canContinue = await window.incrementSubmissionCount();

    if (!canContinue) {
      console.error("❌ Limite de envios atingido");
      alert("Limite diário de envios atingido! Faça upgrade para continuar.");
      return;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // ⬇️ SUBSTITUA O CÓDIGO ABAIXO PELA LÓGICA DA SUA EXTENSÃO
  // ═══════════════════════════════════════════════════════════════════

  console.log("✅ Acesso verificado! Executando automação...");

  // Exemplo: Manipular DOM
  // const button = document.querySelector('#meu-botao');
  // if (button) button.click();

  // Exemplo: Fazer request
  // const response = await fetch('https://api.example.com/data');
  // const data = await response.json();

  // Exemplo: Adicionar elemento
  // const div = document.createElement('div');
  // div.textContent = 'Minha extensão funcionando!';
  // document.body.appendChild(div);

  // ═══════════════════════════════════════════════════════════════════
  // ⬆️ FIM DA ÁREA DE CUSTOMIZAÇÃO
  // ═══════════════════════════════════════════════════════════════════

  console.log("✅ Funcionalidade executada com sucesso!");
}

// Inicializar quando página carregar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
}

console.log("✅ Extensão: Pronta!");
