# 🚀 Nardoto Labs - Extension Management System

Portal centralizado para gerenciar autenticação e permissões de todas as extensões Chrome.

---

## 📋 O que foi criado

### Estrutura do Projeto

```
nardoto-labs/
├── public/                      → Site público (Hosting)
│   ├── index.html              → Landing page
│   ├── login.html              → Login com Google
│   ├── dashboard.html          → Painel do usuário
│   ├── auth/
│   │   └── extension-login.html → Auth para extensões
│   └── assets/
│       └── css/
│           └── main.css        → Estilos
│
├── functions/                   → Cloud Functions
│   ├── index.js                → Webhook Kiwify + Auth
│   └── package.json            → Dependências
│
├── firebase.json               → Config do Firebase
├── .firebaserc                 → Projeto: nardoto-labs
└── firestore.rules             → Regras de segurança
```

---

## ⚙️ SETUP - Passo a Passo

### **1. Criar Projeto no Firebase**

1. Acesse: https://console.firebase.google.com
2. Clique em "Adicionar projeto"
3. Nome do projeto: `nardoto-labs`
4. Desative Google Analytics (opcional)
5. Criar projeto

### **2. Ativar Serviços Firebase**

#### **Authentication**
1. No menu lateral → Authentication
2. Começar
3. Sign-in method → Google → Ativar
4. Support email: seu email
5. Salvar

#### **Firestore Database**
1. No menu lateral → Firestore Database
2. Criar banco de dados
3. Modo: **Produção**
4. Localização: `southamerica-east1` (São Paulo)
5. Ativar

#### **Cloud Functions**
1. No menu lateral → Functions
2. Começar
3. Upgrade para Blaze (paga por uso, tem plano grátis generoso)

### **3. Configurar Firebase no Código**

1. No Firebase Console → Configurações do projeto (ícone engrenagem)
2. Rolar até "Seus apps"
3. Clique no ícone `</>`  (Web)
4. Nome do app: `Nardoto Labs Web`
5. **Copiar o firebaseConfig**
6. Substituir `firebaseConfig` nos arquivos:
   - `public/login.html` (linha ~82)
   - `public/dashboard.html` (linha ~178)
   - `public/auth/extension-login.html` (linha ~131)

**Exemplo:**
```javascript
const firebaseConfig = {
    apiKey: "AIzaSyBxxxxxxxxxxxxxxxxxxxxx",
    authDomain: "nardoto-labs.firebaseapp.com",
    projectId: "nardoto-labs",
    storageBucket: "nardoto-labs.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef123456"
};
```

### **4. Instalar Firebase CLI**

```bash
npm install -g firebase-tools
firebase login
```

### **5. Deploy do Projeto**

```bash
cd C:\Users\tharc\Videos\extension-repos\nardoto-labs

# Deploy tudo (Hosting + Functions + Firestore Rules)
firebase deploy
```

**Saída esperada:**
```
✔  Deploy complete!

Project Console: https://console.firebase.google.com/project/nardoto-labs/overview
Hosting URL: https://nardoto-labs.web.app
```

### **6. Configurar Webhook Kiwify**

#### **6.1. Obter Product IDs da Kiwify**
1. Acesse painel Kiwify
2. Menu Produtos
3. Copie o ID de cada produto (BÁSICO e VIP)

#### **6.2. Atualizar Cloud Functions**
Edite: `functions/index.js` linha 43:

```javascript
const PRODUCT_TO_PLAN = {
  'prod_abc123xyz': 'basic',   // ← Cole o ID real do BÁSICO
  'prod_def456uvw': 'vip'       // ← Cole o ID real do VIP
};
```

#### **6.3. Deploy das Functions**
```bash
firebase deploy --only functions
```

#### **6.4. Configurar Webhook na Kiwify**
1. Kiwify → Configurações → Webhooks
2. Adicionar novo webhook
3. URL: `https://us-central1-nardoto-labs.cloudfunctions.net/kiwifyWebhook`
4. Eventos:
   - ✅ order.paid
   - ✅ subscription.canceled
   - ✅ subscription.expired
   - ✅ order.refunded
5. Salvar

---

## 🌐 Domínio Customizado (Opcional)

### Conectar `nardoto.com.br`

1. Firebase Console → Hosting
2. Adicionar domínio customizado
3. Domínio: `labs.nardoto.com.br`
4. Seguir instruções para adicionar registros DNS

---

## 🎯 Como Usar

### Para Usuários

1. Acesse: `https://nardoto-labs.web.app`
2. Clique em "Acessar Portal"
3. Login com Google
4. Ver extensões ativas no dashboard

### Para Extensões

As extensões devem abrir:
```
https://nardoto-labs.web.app/auth/extension-login.html?extension=VEO3%20Automator
```

Após login, receberão token via `postMessage`.

---

## 📊 Planos Configurados

| Plano | Preço | Features |
|-------|-------|----------|
| FREE | R$ 0 | Trial 3 dias |
| BÁSICO | R$ 197/mês | VEO3 + Wisk + Tradutor |
| VIP | R$ 397/mês | Todas as extensões |

---

## 🔧 Testando Localmente

```bash
# Emulator do Firebase
firebase emulators:start

# Acesse:
http://localhost:5000  (Hosting)
http://localhost:5001/nardoto-labs/us-central1/kiwifyWebhook  (Functions)
```

---

## ✅ Checklist de Deploy

- [ ] Projeto Firebase criado
- [ ] Authentication ativado (Google)
- [ ] Firestore Database criado
- [ ] firebaseConfig atualizado nos 3 arquivos HTML
- [ ] `firebase deploy` executado com sucesso
- [ ] Product IDs da Kiwify configurados
- [ ] Webhook Kiwify configurado
- [ ] Testado login no site
- [ ] Testado webhook com compra de teste

---

## 🚀 Próximos Passos

1. **Modificar Extensões** para usar auth centralizada
2. **Migrar 5 assinantes** existentes para novo sistema
3. **Configurar domínio customizado** (opcional)
4. **Testar fluxo completo** de compra

---

**Desenvolvido por Nardoto** | Nardoto Labs © 2025
