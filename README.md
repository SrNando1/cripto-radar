# CriptoRadar 🟢

Monitor de preços de criptomoedas em tempo real.

## Stack
- React + Vite
- Recharts (gráficos)
- React Router (navegação)
- CoinGecko API (dados gratuitos)

## Dados da API (CoinGecko)

A CoinGecko bloqueia pedidos diretos do browser (CORS), por isso os pedidos passam
por um proxy de mesma origem: o **proxy do Vite** em dev e os **rewrites do `vercel.json`**
em produção. Não é preciso configurar nada para isto funcionar.

A API pública sem chave é fortemente limitada (erros `429`). Para evitar isso, cria uma
**chave demo gratuita** em [coingecko.com/developers/dashboard](https://www.coingecko.com/en/developers/dashboard),
copia o `.env.example` para `.env` e preenche `VITE_CG_API_KEY`.

## Comandos

```bash
# Instalar dependências
npm install

# Desenvolvimento local
npm run dev

# Build para produção
npm run build

# Preview do build
npm run preview
```

## Estrutura

```
src/
├── components/     # Componentes reutilizáveis
│   ├── Navbar
│   ├── CoinTable
│   ├── PriceChart
│   └── GlobalMetrics
├── pages/          # Páginas da app
│   ├── Dashboard
│   ├── Watchlist
│   ├── Alertas
│   └── Planos
├── hooks/          # Custom hooks
│   └── useCoins (re-export do CoinsContext)
├── services/       # Chamadas à API
│   └── api.js
└── context/        # Estado global
    ├── CoinsContext      # polling de preços partilhado
    ├── WatchlistContext
    └── AlertsContext     # alertas de preço (localStorage)
```

## Deploy (Vercel)

1. Push para GitHub
2. Importar projeto no vercel.com
3. Deploy automático em <1 minuto

## Autenticação (Supabase)

1. Cria um projeto gratuito em [supabase.com](https://supabase.com)
2. Em **Project Settings → API**, copia o URL e a `anon` key para o `.env`:
   `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
3. Reinicia o `npm run dev`
4. Para a sincronização da watchlist/alertas: abre o **SQL Editor** no Supabase,
   cola o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e corre (**Run**)

Em dev, podes desativar a confirmação de email em
**Authentication → Providers → Email → Confirm email** para testar mais depressa.

### Login com Google (OAuth)

1. No [Google Cloud Console](https://console.cloud.google.com): cria um projeto →
   **APIs & Services → Credentials → Create Credentials → OAuth client ID** (tipo *Web application*)
2. Em **Authorized redirect URIs** adiciona:
   `https://<o-teu-projeto>.supabase.co/auth/v1/callback`
3. No Supabase: **Authentication → Sign In / Providers → Google** → ativa e cola o
   **Client ID** e **Client Secret**
4. No Supabase: **Authentication → URL Configuration** → define **Site URL** como
   `http://localhost:5173` (e adiciona o domínio de produção quando fizeres deploy)

Com sessão iniciada, a watchlist e os alertas são gravados na cloud (RLS: cada
utilizador só acede aos seus dados) e ficam disponíveis em qualquer dispositivo.
Sem sessão, tudo continua a funcionar localmente (localStorage); ao entrar, os
dados locais são fundidos com os da conta.

## Pagamentos (LemonSqueezy)

1. Cria conta em [lemonsqueezy.com](https://lemonsqueezy.com) e uma **Store** (fica em *test mode*)
2. Cria 2 produtos de **subscrição mensal**: `CriptoRadar Pro` (7€) e `CriptoRadar Trader` (15€)
   — os nomes devem conter "Pro"/"Trader" (é assim que o webhook mapeia o plano)
3. Em cada produto, botão **Share** → copia o link de checkout para o `.env`:
   `VITE_LS_CHECKOUT_PRO` e `VITE_LS_CHECKOUT_TRADER`
4. Corre [`supabase/payments.sql`](supabase/payments.sql) no SQL Editor do Supabase
5. **Após o deploy na Vercel**: no LS, **Settings → Webhooks → +**:
   - URL: `https://<o-teu-dominio>/api/ls-webhook`
   - Signing secret: inventa um e guarda-o
   - Eventos: todos os `subscription_*`
6. Na Vercel, **Settings → Environment Variables**:
   `LEMONSQUEEZY_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   (a service role está em Project Settings → API — é secreta, nunca no frontend)

Fluxo: o utilizador clica em "Começar Pro" → checkout LS (email + `user_id` anexados)
→ paga → o LS chama `/api/ls-webhook` → o webhook valida a assinatura HMAC e grava
o plano na tabela `profiles` → a app lê o plano via `PlanContext`.

O webhook só funciona com a app publicada (o LS não consegue chamar `localhost`).
Usa o *test mode* do LS (cartão `4242 4242 4242 4242`) para testar sem dinheiro real.

## Próximos passos

- [x] Alertas de preço (notificações do browser)
- [x] Autenticação (Supabase)
- [x] Sincronizar watchlist/alertas na cloud (Supabase DB + RLS)
- [x] Pagamentos (LemonSqueezy) — código pronto; falta config LS + deploy
- [ ] Deploy na Vercel
- [x] Impor limites do Free na app (watchlist máx. 5, gráfico até 7 dias)
- [x] Alertas de preço por email (Pro) — Edge Function + Resend; requer deploy
- [ ] PWA (instalável no telemóvel)

## Alertas por email (Edge Function + Resend)

Server-side, corre mesmo com a app fechada (só plano Pro/Trader).

1. Corre [`supabase/email-alerts.sql`](supabase/email-alerts.sql) (adiciona a coluna `notify_email`)
2. Cria conta em [resend.com](https://resend.com), verifica um domínio (ou usa `onboarding@resend.dev` para testes) e cria uma **API key**
3. Define os secrets da função:
   ```bash
   supabase secrets set RESEND_API_KEY=re_... ALERT_FROM_EMAIL="CriptoRadar <alertas@teudominio.pt>" CG_API_KEY=CG-...
   supabase functions deploy check-alerts
   ```
4. Agenda o cron de 5 em 5 min: ativa as extensões `pg_cron` e `pg_net` e corre o
   bloco `cron.schedule` (comentado) no fim do `email-alerts.sql`, com o teu projeto/service key
5. Na app, um utilizador Pro liga "📧 Avisar também por email" ao criar um alerta
