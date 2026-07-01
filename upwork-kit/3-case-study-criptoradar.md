# CriptoRadar — Case Study (para portfólio / clientes)

> Versão em inglês para mostrar a clientes Upwork. Adapta o tom à vontade.
> Mete isto no Portfolio do Upwork, no teu GitHub README e/ou numa página simples.

---

## CriptoRadar — A full-stack crypto-tracking SaaS

**Role:** Sole developer (design, frontend, backend, infrastructure)
**Stack:** React 19, Vite, Supabase (Postgres + Auth + Edge Functions), Recharts,
LemonSqueezy, Resend, Vercel
**Live demo:** [adiciona o link]  ·  **Code:** [adiciona o link do GitHub se for público]

### What it is
A SaaS web app that tracks cryptocurrency prices in real time and lets users build
watchlists, set price alerts, and get an AI-generated market analysis. It has a free tier
and paid subscription plans.

### What I built

**Frontend**
- React 19 + Vite single-page app with client-side routing
- Real-time price data with shared polling (one data source feeds the whole app, so the
  external API isn't hammered)
- Interactive price charts (Recharts)
- Responsive UI with free-tier limits enforced in the app (watchlist cap, chart range)

**Authentication & data**
- Supabase auth: email/password **and** Google OAuth
- Postgres with **row-level security** — every user can only read/write their own data
- Offline-first: works via localStorage when logged out, then merges local data into the
  account on login, syncing watchlist and alerts across devices

**Payments**
- Subscription checkout via LemonSqueezy
- A serverless webhook that **verifies the HMAC signature**, then writes the user's plan
  to the database; the app gates Pro features by reading that plan

**Backend / automation**
- Supabase **Edge Function** that checks price alerts server-side and sends emails (via
  Resend) — runs on a **cron schedule every 5 minutes, even when the app is closed**
- Solved real-world API problems: CoinGecko CORS (same-origin proxy) and rate limits (429s)

**AI feature**
- AI-powered market analysis via an LLM API, with 1-hour response caching to control cost
  and latency

### Why it matters to a client
This isn't a tutorial project. It includes the parts that real products need and that
break in production: secure auth with RLS, payment webhooks with signature verification,
scheduled serverless jobs, third-party API integration with rate-limit handling, and an
LLM integration with caching. I took it from zero to a working, deployable product alone.

---

## Screenshots a incluir (tira tu)
1. Dashboard com a tabela de preços + métricas globais
2. Gráfico de uma moeda (PriceChart)
3. Página de Alertas (criar alerta + opção de email)
4. Checkout / página de Planos
5. (Opcional) a análise com IA

> Dica: imagens limpas, sem dados pessoais, ~1200px de largura.
```
