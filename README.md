# CriptoRadar

A freemium **SaaS for tracking cryptocurrency prices and portfolios**: live market data, watchlists, price alerts (browser and email), a portfolio tracker and AI-generated coin analysis, behind **Free / Pro / Trader** subscription plans.

**Live demo:** [cripto-radar.vercel.app](https://cripto-radar.vercel.app) (the interface is in Portuguese)

## Features

| | Free | Pro (€4/mo) | Trader (€7/mo) |
|---|:---:|:---:|:---:|
| Coins in the market table | top 20 | top 250 | top 250 |
| Price refresh | 60 s | 10 s | 10 s |
| Watchlist | 5 coins | unlimited | unlimited |
| Portfolio positions | 3 | unlimited | unlimited |
| Chart history | 7 days | up to 1 year | up to 1 year |
| Intraday charts (30 s / 1 m / 30 m) | | ✓ | ✓ |
| Price alerts (browser) | ✓ | ✓ | ✓ |
| Price alerts by email | | ✓ | ✓ |
| AI analysis per coin | | ✓ | ✓ |
| Coin search, CSV import | | | ✓ |
| Real-time prices (Binance WebSocket) | | | ✓ |

Plan limits live in a single file, [`src/config/plans.js`](src/config/plans.js), which the UI reads to gate features.

Other highlights:

- **Works without an account.** Watchlist and alerts are kept in `localStorage`; on sign-in, local data is merged into the account and then synced to the cloud, so it follows the user across devices.
- **Email + Google sign-in** through Supabase Auth.
- **Row Level Security** on every table: each user can only read and write their own rows.
- **Server-side alerts.** Email alerts are checked by a scheduled Edge Function, so they fire even when the app is closed.
- **Shared AI cache.** The AI analysis is cached per coin for one hour, so the model is only called when needed.

## Architecture

```
Browser (React + Vite)
 ├─ CoinGecko REST ──── via same-origin proxy (Vite in dev, Vercel Edge Function in prod)
 ├─ Binance WebSocket ─ live prices (Trader plan)
 ├─ Supabase ────────── Auth, Postgres (RLS), Edge Functions
 └─ LemonSqueezy ────── hosted checkout

Vercel Edge Function  /api/ls-webhook   LemonSqueezy webhook → verifies HMAC signature → writes plan to `profiles`
Supabase Edge Function ai-analysis       JWT + plan check → OpenRouter (model fallback list) → 1 h cache
Supabase Edge Function check-alerts      pg_cron every 5 min → evaluates alerts → sends email via Resend
```

**Payment flow:** the user clicks "Start Pro" → LemonSqueezy checkout (email and `user_id` attached) → payment → LemonSqueezy calls `/api/ls-webhook` → the webhook validates the HMAC signature and stores the plan in `profiles` → the app reads it through `PlanContext`. The service-role key is only ever used server-side.

## Tech stack

- **Frontend:** React 19, Vite, React Router 7, Recharts, CSS Modules
- **Backend:** Supabase (Auth, Postgres, Row Level Security, Edge Functions in Deno), Vercel Edge Functions
- **Integrations:** CoinGecko, Binance (public WebSocket and klines), LemonSqueezy (payments), OpenRouter (AI), Resend (email)
- **Hosting:** Vercel

## Getting started

```bash
npm install
cp .env.example .env      # fill in the values below
npm run dev               # http://localhost:5173
```

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview the build |
| `npm run lint` | ESLint |

### Environment variables

Client-side (`.env`, prefixed `VITE_`, safe to expose):

| Variable | Purpose |
|---|---|
| `VITE_CG_API_KEY` | Free CoinGecko demo key (optional; without it the public API returns `429` often) |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Supabase project. The anon key is public by design; security comes from RLS |
| `VITE_LS_CHECKOUT_PRO`, `VITE_LS_CHECKOUT_TRADER` | LemonSqueezy checkout links |

Server-side only (Vercel / Supabase secrets, **never** with the `VITE_` prefix):
`LEMONSQUEEZY_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`, `RESEND_API_KEY`, `ALERT_FROM_EMAIL`.

### Setting up Supabase

1. Create a free project at [supabase.com](https://supabase.com) and copy the URL and anon key into `.env`.
2. In the **SQL Editor**, run the files in [`supabase/`](supabase): `schema.sql` (profiles, watchlist, alerts), `portfolio.sql`, `payments.sql`, `ai-analysis.sql` and `email-alerts.sql`.
3. **Google sign-in (optional):** create an OAuth client in Google Cloud Console, add `https://<project>.supabase.co/auth/v1/callback` as a redirect URI, then enable the Google provider in **Authentication → Providers** and set the **Site URL** under **URL Configuration**.
4. While developing, you can turn off **Confirm email** to test sign-up faster.

### Payments (LemonSqueezy)

1. Create a store (it starts in test mode) and two monthly subscription products whose names contain **"Pro"** and **"Trader"**. The webhook maps the plan from the product name.
2. Copy each product's **Share** link into `VITE_LS_CHECKOUT_PRO` / `VITE_LS_CHECKOUT_TRADER`.
3. After deploying, add a webhook in LemonSqueezy pointing to `https://<your-domain>/api/ls-webhook`, subscribed to the `subscription_*` events, with a signing secret you also set as `LEMONSQUEEZY_WEBHOOK_SECRET` in Vercel.
4. Test with LemonSqueezy's test mode and card `4242 4242 4242 4242`. The webhook only works on a deployed app, since LemonSqueezy can't reach `localhost`.

### Email alerts and AI analysis (Supabase Edge Functions)

```bash
supabase secrets set OPENROUTER_API_KEY=... RESEND_API_KEY=... ALERT_FROM_EMAIL="CriptoRadar <alerts@your-domain>" CG_API_KEY=...
supabase functions deploy ai-analysis
supabase functions deploy check-alerts
```

Then enable the `pg_cron` and `pg_net` extensions and run the (commented) `cron.schedule` block at the end of `supabase/email-alerts.sql` to check alerts every 5 minutes. `ai-analysis` tries a list of free OpenRouter models in order, because shared free models are often rate-limited.

### Deploying (Vercel)

Import the repository in Vercel and deploy. [`vercel.json`](vercel.json) rewrites `/api/cg/*` to the CoinGecko proxy (needed because CoinGecko blocks direct browser requests with CORS) and falls back to `index.html` for client-side routes.

## Project structure

```
api/                    Vercel Edge Functions (CoinGecko proxy, LemonSqueezy webhook)
supabase/               SQL migrations and Edge Functions (ai-analysis, check-alerts)
src/
├─ components/          Navbar, CoinTable, PriceChart, AlertModal, AiAnalysisModal, UpgradeModal...
├─ pages/               Dashboard, Watchlist, Portfolio, Alertas (alerts), Planos (plans), Conta (account)
├─ context/             Auth, Plan, Coins (shared polling), Watchlist, Portfolio, Alerts
├─ config/plans.js      Per-plan limits: single source of truth for the freemium logic
└─ services/            CoinGecko, Binance and Supabase clients
```

## Roadmap

- [ ] Installable PWA
