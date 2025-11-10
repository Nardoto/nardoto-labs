# 🔐 Guia de Integração - Nardoto Labs Auth

## 📋 Resumo do Sistema

O **Nardoto Labs** é um sistema de autenticação centralizada para todas as extensões Chrome da Nardoto. Com ele, o usuário faz login uma única vez e todas as extensões funcionam automaticamente.

### ✅ Vantagens

- **Login único:** Usuário faz login uma vez para todas as extensões
- **Gerenciamento centralizado:** Controle de planos e assinaturas em um só lugar
- **Trial automático:** 3 dias de trial completo para novos usuários
- **Dashboard unificado:** Usuário visualiza todas as extensões em um lugar
- **Integração Kiwify:** Ativação automática de planos via webhook

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                     NARDOTO LABS                            │
│               labs.nardoto.com.br                           │
│                                                             │
│  ┌──────────┐  ┌────────────┐  ┌──────────────────┐       │
│  │  Login   │  │ Dashboard  │  │ Extension Auth   │       │
│  │ Page     │  │            │  │ (popup window)   │       │
│  └──────────┘  └────────────┘  └──────────────────┘       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Firebase Auth + Firestore + Cloud Functions        │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ postMessage (token)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│               EXTENSÕES CHROME                              │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────────┐    │
│  │ VEO3         │ │ Wisk         │ │ Tradutor AI     │    │
│  │ Automator    │ │ Automator    │ │ Ilimitado       │    │
│  └──────────────┘ └──────────────┘ └─────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## 🔄 Fluxo de Autenticação

### 1. Usuário abre a extensão

```
┌─────────────┐
│  Extensão   │ ──① Verifica storage local
│   Chrome    │    (tem token salvo?)
└─────────────┘
      │
      ├──► SIM: Valida token e libera funcionalidade
      │
      └──► NÃO: Abre janela de login
```

### 2. Login na janela popup

```
┌─────────────┐
│  Extensão   │ ──② Abre popup
│   Chrome    │    labs.nardoto.com.br/auth/extension-login.html
└─────────────┘
      │
      ▼
┌─────────────────────┐
│  Popup de Login     │ ──③ Google OAuth
│  (Nardoto Labs)     │
└─────────────────────┘
      │
      ▼
┌─────────────────────┐
│  Firebase Auth      │ ──④ Gera ID Token
│                     │
└─────────────────────┘
      │
      ▼
┌─────────────────────┐
│  postMessage()      │ ──⑤ Envia token de volta
│  para extensão      │
└─────────────────────┘
      │
      ▼
┌─────────────┐
│  Extensão   │ ──⑥ Salva token e fecha popup
│  armazena   │
└─────────────┘
```

### 3. Verificação de permissões

```
┌─────────────┐
│  Extensão   │ ──⑦ Envia token para Firebase
│             │
└─────────────┘
      │
      ▼
┌──────────────────────┐
│  Firebase API        │ ──⑧ Valida token
│  identitytoolkit     │    Retorna UID
└──────────────────────┘
      │
      ▼
┌──────────────────────┐
│  Firestore           │ ──⑨ Busca dados do usuário
│  users/{uid}         │    (plan, features, trial)
└──────────────────────┘
      │
      ▼
┌─────────────┐
│  Extensão   │ ──⑩ Verifica permissões
│  decide     │    e libera/bloqueia
└─────────────┘
```

## 📦 Estrutura de Dados - Firestore

### Documento do Usuário (`users/{uid}`)

```javascript
{
  email: "usuario@exemplo.com",
  displayName: "Nome do Usuário",
  photoURL: "https://...",

  // Plano
  plan: "basic",           // "free", "basic", "vip"
  isPro: true,

  // Features
  features: [
    "veo3-automator",      // ✅ Acesso ao VEO3
    "wisk-automator",      // ✅ Acesso ao Wisk
    "tradutor-ai-unlimited"// ✅ Acesso ao Tradutor
  ],
  // OU
  features: ["all-features"], // ✅ Acesso a TUDO (Plano VIP)

  // Trial
  trialExpiresAt: "2025-11-12T23:59:59.000Z", // ISO String

  // Kiwify
  kiwifyProductId: "...",
  kiwifyOrderId: "...",
  kiwifyOrderRef: "...",

  // Timestamps
  createdAt: Timestamp,
  lastLogin: Timestamp,
  proActivatedAt: Timestamp
}
```

## 🔑 Planos Disponíveis

### FREE (Grátis)
- **Preço:** R$ 0
- **Features:** Nenhuma (apenas trial de 3 dias)
- **Trial:** 3 dias completos ao criar conta

### BÁSICO
- **Preço:** R$ 197
- **Features:**
  - `veo3-automator` ✅
  - `wisk-automator` ✅
  - `tradutor-ai-unlimited` ✅

### VIP
- **Preço:** R$ 397
- **Features:**
  - `all-features` ✅ (acesso a TUDO, incluindo futuras extensões)

## 💻 Código de Integração

### 1. Adicionar ao `manifest.json`

```json
{
  "manifest_version": 3,
  "name": "VEO3 Automator",
  "version": "2.0.0",
  "permissions": [
    "storage",
    "tabs"
  ],
  "host_permissions": [
    "https://nardoto-labs.web.app/*",
    "https://labs.nardoto.com.br/*",
    "https://identitytoolkit.googleapis.com/*",
    "https://firestore.googleapis.com/*"
  ],
  "background": {
    "service_worker": "background.js"
  }
}
```

### 2. Copiar o código do `extension-auth-example.js`

Copie o arquivo `extension-auth-example.js` para dentro da sua extensão e adapte:

```javascript
// No seu background.js ou service worker
const auth = new NardotoLabsAuth('VEO3 Automator'); // Nome da extensão
auth.init();

// Antes de executar qualquer funcionalidade
async function executeFeature() {
    if (!auth.isAuthenticated()) {
        await auth.login();
    }

    const hasPermission = await auth.checkPermissions();

    if (hasPermission) {
        // ✅ Executar funcionalidade
        console.log('Acesso liberado!');
    } else {
        // ❌ Redirecionar para upgrade
        chrome.tabs.create({
            url: 'https://labs.nardoto.com.br/dashboard.html'
        });
    }
}
```

## 🧪 Testando a Integração

### 1. Testar localmente

1. Abra http://localhost:5000 (servidor Firebase)
2. Faça login com sua conta Google
3. Vá ao Dashboard e veja seu plano e extensões

### 2. Testar a extensão

1. Carregue a extensão no Chrome (modo desenvolvedor)
2. Abra a extensão
3. Ela deve abrir o popup de login automaticamente
4. Faça login e veja o token ser salvo
5. A extensão deve verificar permissões e liberar o uso

### 3. Testar planos

Use os scripts de teste:

```bash
# Ativar plano BÁSICO
powershell -ExecutionPolicy Bypass -File test-activate-plan-prod.ps1

# Agora recarregue o dashboard para ver as mudanças
```

## 🎯 Features por Extensão

| Extensão | Feature ID | Plano Necessário |
|----------|-----------|------------------|
| VEO3 Automator | `veo3-automator` | BÁSICO ou VIP |
| Wisk Automator | `wisk-automator` | BÁSICO ou VIP |
| Tradutor AI Ilimitado | `tradutor-ai-unlimited` | BÁSICO ou VIP |

## 🔗 URLs Importantes

- **Portal:** https://nardoto-labs.web.app
- **Login:** https://nardoto-labs.web.app/login.html
- **Dashboard:** https://nardoto-labs.web.app/dashboard.html
- **Extension Auth:** https://nardoto-labs.web.app/auth/extension-login.html
- **Webhook Kiwify:** https://us-central1-tradutor-profissional-ai.cloudfunctions.net/kiwifyWebhook

## 💳 Integração Kiwify

O webhook já está configurado e ativo. Quando um usuário comprar no Kiwify:

1. Kiwify envia webhook `order.paid` com o email do cliente
2. Cloud Function identifica o produto comprado
3. Busca o usuário pelo email no Firestore
4. Ativa o plano e adiciona as features
5. Usuário automaticamente tem acesso nas extensões

### Produtos Kiwify

Configurar os produtos na Kiwify com os seguintes nomes:

- `Tradutor Profissional AI - BÁSICO` → Ativa plano BÁSICO
- `Tradutor Profissional AI - VIP` → Ativa plano VIP

## 🚀 Próximos Passos

1. ✅ Sistema de auth criado
2. ✅ Dashboard funcionando
3. ✅ Webhook Kiwify configurado
4. ⏳ Integrar nas extensões existentes (VEO3, Wisk, Tradutor)
5. ⏳ Configurar domínio customizado labs.nardoto.com.br
6. ⏳ Testar fluxo completo de ponta a ponta

## 📞 Suporte

Em caso de dúvidas, verifique:
- Logs do Firebase Functions
- Console do navegador (F12)
- Storage da extensão (`chrome.storage.local`)
