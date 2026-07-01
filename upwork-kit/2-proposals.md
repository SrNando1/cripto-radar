# Proposals que convertem

## Regras de ouro

1. **Personaliza as 2 primeiras frases.** O cliente vê só ~2 linhas no preview. Se começares com
   "I am a hardworking developer with 5 years..." está perdido. Começa pelo **problema dele**.
2. **Prova, não promessas.** Liga sempre a algo que já fizeste (o CriptoRadar resolve isto).
3. **Faz UMA pergunta.** Cria conversa e mostra que leste o anúncio.
4. **Curto.** 4-6 frases. Ninguém lê paredes de texto.
5. **Sem erros de inglês.** Relê. Um typo na proposal = "não tem atenção ao detalhe".
6. **Responde rápido.** Jobs com < 5 propostas e postados há < 1h convertem muito melhor.

---

## Estrutura base

```
[Frase 1 — mostra que percebeste o problema específico dele]
[Frase 2 — diz que JÁ fizeste exatamente isto, com prova]
[Frase 3-4 — como abordarias, 2-3 pontos concretos]
[Pergunta — uma só, específica do projeto]
[Fecho curto + disponibilidade]
```

---

## Exemplo 1 — Job de Supabase (auth / RLS / database)

> *Anúncio típico: "Need help setting up Supabase auth and database for my app"*

```
Hi [nome] — setting up Supabase auth correctly (especially row-level security) is exactly
where most projects either stay secure or quietly leak data, so it's worth getting right.

I recently built a full SaaS on Supabase with email + Google OAuth and RLS policies that
guarantee each user only ever accesses their own rows — I can share it.

For your project I'd: (1) set up the auth flows, (2) write RLS policies tested against
real cases, and (3) leave you a clean schema you can extend.

Quick question: are you using Supabase's built-in auth UI, or a custom React/Next frontend?

Happy to hop on a short call. I can start this week.
```

---

## Exemplo 2 — React MVP / SaaS

> *Anúncio: "Looking for a developer to build an MVP web app (React)"*

```
Hi [nome] — the hard part of an MVP isn't the UI, it's wiring up auth, data and payments
so it actually works as a product. That's what I do.

I built CriptoRadar end-to-end: React 19 frontend, Supabase auth + database, subscription
payments via webhooks, and serverless functions. I can show you the live app.

For your MVP I'd start with the core flow you described — [referir a feature principal do
anúncio] — get it working and deployed fast, then iterate with you.

What's the one feature that, if it works, makes this MVP a success for you?

Available to start now — would love to hear more.
```

---

## Exemplo 3 — Crypto / dashboard / API integration (o teu nicho mais forte)

> *Anúncio: "Need a crypto price dashboard / integrate CoinGecko API"*

```
Hi [nome] — I've built exactly this. CriptoRadar pulls live crypto data (via the CoinGecko
API, proxied to avoid CORS), shows it in real time with interactive charts, and lets users
set price alerts.

I already solved the parts that usually trip people up here: API rate limits (429s),
the CORS proxy, shared polling so the app doesn't hammer the API, and server-side alerts
that run even when the app is closed.

I'd map your requirements to that foundation and adapt it to your design.

Which data do you need beyond price — market cap, volume, historical charts, alerts?

Can start immediately. Link to the live app on request.
```

---

## Exemplo 4 — Webhooks / pagamentos / integrações

```
Hi [nome] — payment webhooks are easy to get 80% right and dangerous in the last 20%
(signature verification, idempotency, syncing state correctly). I've shipped this in
production.

In my SaaS I handle subscription webhooks with HMAC signature validation that writes the
plan to the database, which the app then reads to gate features. I can walk you through it.

For your case I'd verify signatures, handle the subscription lifecycle events, and make
the sync reliable against retries.

Which payment provider are you on — Stripe, LemonSqueezy, Paddle?

Ready to start. Happy to show the existing implementation.
```

---

## Onde colar o link do projeto
Quando o cliente responder e pedir prova, manda o link da app + o `3-case-study`.
Não metas links externos na primeira proposal (o Upwork penaliza e às vezes esconde-os).
```
