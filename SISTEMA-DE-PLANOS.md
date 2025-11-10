# 💎 Sistema de Planos - Nardoto Labs

## 📋 Planos Disponíveis

### FREE (Grátis)
- **Características:**
  - Trial de 3 dias ao criar conta
  - Após trial: sem acesso às extensões
- **Features:** `[]` (vazio)
- **isPro:** `false`

### BÁSICO (R$ 197)
- **Características:**
  - Acesso a 3 extensões principais
  - Ideal para usuários que querem todas as ferramentas atuais
- **Features:**
  - `veo3-automator`
  - `wisk-automator`
  - `tradutor-ai-unlimited`
- **isPro:** `true`

### VIP (R$ 397)
- **Características:**
  - Acesso a TODAS as extensões (atuais e futuras)
  - Feature especial: `all-features`
- **Features:**
  - `all-features` (acesso a tudo)
- **isPro:** `true`

---

## 🛠️ Ativação Manual (Admin)

### Passo a Passo:

1. **Acesse o Admin:**
   - URL: https://tradutor-profissional-ai.web.app/admin.html
   - Faça login com: `tharcisionardoto@gmail.com`

2. **Procure o usuário:**
   - Use a busca para encontrar por email
   - Ou role a lista de usuários

3. **Ativar Plano:**
   - Clique em **"Ativar PRO"**
   - Escolha o plano:
     - `1` - FREE (remover acesso)
     - `2` - BÁSICO (3 extensões)
     - `3` - VIP (tudo)
   - Confirme

4. **Pronto!**
   - O usuário já pode recarregar o dashboard
   - As extensões serão liberadas automaticamente

### Quando usar ativação manual:

- ✅ Usuário comprou mas webhook não funcionou
- ✅ Quer dar acesso de teste/cortesia
- ✅ Usuário tem problema com pagamento e quer liberar manualmente
- ✅ Migração de usuários de outro sistema

---

## 🤖 Ativação Automática (Kiwify)

### Como Funciona:

1. **Usuário compra na Kiwify**
2. Kiwify envia webhook para:
   ```
   https://us-central1-tradutor-profissional-ai.cloudfunctions.net/kiwifyWebhook
   ```
3. Cloud Function recebe o webhook
4. Busca o usuário pelo email
5. Identifica o produto comprado
6. Ativa o plano automaticamente

### Configuração na Kiwify:

#### 1. Criar os Produtos

Na Kiwify, crie produtos com os nomes **EXATOS**:

**Produto BÁSICO:**
- Nome: `Tradutor Profissional AI - BÁSICO`
- Preço: R$ 197
- Webhook: Configurado (ver passo 2)

**Produto VIP:**
- Nome: `Tradutor Profissional AI - VIP`
- Preço: R$ 397
- Webhook: Configurado (ver passo 2)

#### 2. Configurar Webhook

Em cada produto na Kiwify:

1. Vá em **Configurações** → **Webhooks**
2. Cole a URL:
   ```
   https://us-central1-tradutor-profissional-ai.cloudfunctions.net/kiwifyWebhook
   ```
3. Marque os eventos:
   - ✅ **order.paid** (pagamento aprovado)
   - ✅ **subscription.canceled** (assinatura cancelada)
   - ✅ **subscription.expired** (assinatura expirada)
   - ✅ **order.refunded** (reembolso)
4. Salve

#### 3. Mapeamento de Produtos

O webhook identifica o produto pelo **nome**. Veja o código:

```javascript
const PRODUCT_MAPPING = {
  'Tradutor Profissional AI - BÁSICO': 'basic',
  'Tradutor Profissional AI - VIP': 'vip',
  // Adicione mais produtos aqui
};
```

Se você criar produtos com nomes diferentes, precisa atualizar este mapeamento na Cloud Function.

### Testar Webhook

Use o script de teste:

```bash
cd "C:\Users\tharc\Videos\extension-repos\nardoto-labs"
powershell -ExecutionPolicy Bypass -File test-activate-plan-prod.ps1
```

Ou simule uma compra no ambiente de teste da Kiwify.

---

## 🔄 Quando Usar Cada Método

### Ativação Manual (Admin)
Use quando:
- 🔴 Webhook não funcionou (problema técnico)
- 🎁 Quer dar acesso de cortesia/teste
- 🔧 Migração de usuários de outro sistema
- ⚡ Quer ativar imediatamente sem depender de webhook

### Ativação Automática (Kiwify)
Use quando:
- ✅ Sistema funcionando normalmente
- ✅ Vendas recorrentes
- ✅ Não quer intervir manualmente em cada venda

**Recomendação:** Configure o webhook da Kiwify, mas sempre tenha o admin como backup para ativação manual.

---

## 📊 Verificando Status do Usuário

### No Admin:
- Lista mostra badge: **GRÁTIS** / **PRO** / **TESTE**
- Mostra dias restantes de trial
- Mostra número de traduções hoje

### No Dashboard do Usuário:
- URL: https://nardoto-labs.web.app/dashboard.html
- Mostra plano atual (FREE / BÁSICO / VIP)
- Mostra extensões liberadas
- Mostra trial restante (se aplicável)

---

## 🚨 Troubleshooting

### Problema: "Ativei manualmente mas usuário ainda está FREE"

**Solução:**
1. Verifique se salvou corretamente (deve aparecer toast de sucesso)
2. Usuário deve **recarregar** o dashboard (F5)
3. Verifique no Firestore se os campos foram atualizados:
   - `plan: 'basic'` ou `'vip'`
   - `isPro: true`
   - `features: [...]` array com as features

### Problema: "Webhook não está ativando automaticamente"

**Soluções:**

1. **Verificar nome do produto:**
   - Deve ser exatamente: `Tradutor Profissional AI - BÁSICO` ou `Tradutor Profissional AI - VIP`
   - Letras maiúsculas/minúsculas importam

2. **Verificar logs da Cloud Function:**
   ```bash
   firebase functions:log --project tradutor-profissional-ai
   ```

3. **Testar webhook manualmente:**
   - Use o script test-activate-plan-prod.ps1
   - Ou use Postman/Insomnia para enviar POST

4. **Verificar se usuário existe:**
   - Webhook busca usuário por email
   - Se usuário não existe, cria pending_activation
   - Quando usuário criar conta, a ativação pendente será processada

### Problema: "Usuário comprou mas não tem conta ainda"

**Como funciona:**

1. Webhook recebe compra
2. Não encontra usuário por email
3. Cria documento em `pending_activations` collection
4. Quando usuário criar conta, sistema verifica pending_activations
5. Ativa automaticamente

**Para forçar ativação:**
- Peça para o usuário criar conta primeiro
- Ou ative manualmente via admin após ele criar conta

---

## 📝 Resumo - Fluxo Completo

### Fluxo Ideal (Automático):

```
1. Cliente compra na Kiwify
   ↓
2. Kiwify envia webhook
   ↓
3. Cloud Function recebe
   ↓
4. Busca usuário por email
   ↓
5. Ativa plano automaticamente
   ↓
6. Cliente recarrega dashboard
   ↓
7. ✅ Extensões liberadas
```

### Fluxo Backup (Manual):

```
1. Cliente compra na Kiwify
   ↓
2. Webhook falhou ou cliente reportou problema
   ↓
3. Você entra no Admin
   ↓
4. Procura email do cliente
   ↓
5. Clica "Ativar PRO" → Escolhe plano
   ↓
6. Cliente recarrega dashboard
   ↓
7. ✅ Extensões liberadas
```

---

## 🎯 Checklist de Configuração

- [x] Admin atualizado com sistema de planos
- [x] Firestore rules permitindo acesso admin
- [x] Cloud Function com webhook Kiwify
- [ ] Produtos criados na Kiwify com nomes corretos
- [ ] Webhooks configurados na Kiwify
- [ ] Testar compra de teste para validar webhook
- [ ] Documentar para equipe de suporte

---

## 📞 Suporte

Para problemas ou dúvidas:

1. Verificar logs da Cloud Function
2. Testar ativação manual via admin
3. Verificar se webhook está configurado na Kiwify
4. Verificar estrutura de dados no Firestore
