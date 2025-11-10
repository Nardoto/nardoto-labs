# 📦 Template - Extensão com Autenticação Nardoto Labs

Este é um template pronto para criar novas Chrome Extensions com autenticação centralizada Nardoto Labs.

## 🚀 Como Usar Este Template

### Passo 1: Copiar e Renomear

```bash
# Copie esta pasta
cp -r template-extension minha-extensao

# Entre na pasta
cd minha-extensao
```

### Passo 2: Fazer Substituições (BUSCAR E SUBSTITUIR)

Use o Find & Replace do seu editor (Ctrl+H) para substituir:

| 🔍 Buscar | ✏️ Substituir Por |
|-----------|-------------------|
| `SUA_EXTENSAO_NOME` | Nome Real da Extensão |
| `https://SEU_SITE.com/*` | URL onde funciona |
| `window.firebaseTEMPLATE` | `window.firebaseSuaExtensao` |
| `window.authTEMPLATE` | `window.authSuaExtensao` |
| `template-extension` | ID único (ex: `wisk-automator`) |
| `Template Extension` | Nome Real da Extensão |

**Exemplo real:**

| 🔍 Buscar | ✏️ Substituir Por |
|-----------|-------------------|
| `SUA_EXTENSAO_NOME` | Wisk Automator |
| `https://SEU_SITE.com/*` | `https://wisk.com/*` |
| `window.firebaseTEMPLATE` | `window.firebaseWisk` |
| `window.authTEMPLATE` | `window.authWisk` |
| `template-extension` | `wisk-automator` |
| `Template Extension` | Wisk Automator |

### Passo 3: Adicionar Sua Lógica

Edite `src/core/content.js` na função `executeMainFunctionality()`:

```javascript
async function executeMainFunctionality() {
  // ⬇️ SEU CÓDIGO AQUI
  console.log("Minha extensão funcionando!");

  // Exemplo: clicar em botão
  const btn = document.querySelector('#submit-button');
  if (btn) btn.click();
  // ⬆️ FIM DO SEU CÓDIGO
}
```

### Passo 4: Testar

1. Abra `chrome://extensions/`
2. Ative "Modo do desenvolvedor"
3. Clique "Carregar sem compactação"
4. Selecione a pasta da sua extensão
5. Navegue até o site configurado
6. Teste o login!

## 📁 Estrutura de Arquivos

```
template-extension/
├── manifest.json                    ← Configuração da extensão
├── src/
│   ├── auth/
│   │   ├── firebase-config.js      ← Cliente Firebase REST API
│   │   └── auth-manager.js         ← Sistema de autenticação
│   ├── background/
│   │   └── update-handler.js       ← OAuth flow
│   └── core/
│       └── content.js              ← Sua lógica aqui!
├── _INSTRUCOES.txt                 ← Guia rápido
└── README.md                       ← Este arquivo
```

## ⚙️ Configuração no Firestore

Para adicionar sua extensão aos planos:

### Plano VIP (all-features)
✅ Nada a fazer! VIP já tem acesso automático

### Plano BÁSICO
Adicione o EXTENSION_ID ao array `features`:

```javascript
// Admin Panel → Editar Usuário
{
  features: ['veo3-automator', 'wisk-automator', 'sua-nova-extensao']
}
```

### Criar Novo Plano
1. Crie produto no Kiwify
2. Configure webhook para adicionar feature específica
3. Defina `REQUIRED_PLANS` em `auth-manager.js`

## 🧪 Checklist de Teste

- [ ] Login funciona (abre popup e salva sessão)
- [ ] Usuário VIP tem acesso ilimitado
- [ ] Usuário BÁSICO tem acesso se extensão está em features
- [ ] Usuário FREE com trial tem acesso limitado (15 envios/dia)
- [ ] Usuário FREE sem trial vê mensagem de bloqueio
- [ ] Logout funciona e recarrega página
- [ ] UI de autenticação aparece corretamente
- [ ] Contador de envios incrementa (trial)
- [ ] Limite diário bloqueia após 15 envios (trial)
- [ ] Banner de upgrade mostra link para dashboard

## 📚 Documentação Completa

- **Guia Completo:** `/GUIA-IMPLEMENTACAO-EXTENSOES.md`
- **Dashboard:** https://nardoto-labs.web.app/dashboard.html
- **Admin Panel:** https://nardoto-labs.web.app/admin.html

## 🆘 Troubleshooting

### Erro: "Cannot read 'initialize'"
→ Verifique se o nome `window.firebaseTEMPLATE` bate em todos os arquivos

### Erro: "User not found in Firestore"
→ Faça login pelo dashboard primeiro, depois use a extensão

### Sessão não persiste
→ Adicione permissão `"storage"` no manifest.json

### Banner não aparece
→ Usuários VIP não veem banner (proposital)

---

**Desenvolvido por:** Nardoto
**Sistema:** Nardoto Labs
**Versão:** 1.0.0
