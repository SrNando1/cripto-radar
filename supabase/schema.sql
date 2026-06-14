-- Schema do CriptoRadar
-- Correr no Supabase: SQL Editor → New query → colar → Run

-- Watchlist: uma linha por (utilizador, moeda); snapshot da moeda em jsonb
create table if not exists public.watchlist_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  coin_id text not null,
  coin jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, coin_id)
);

-- Alertas de preço: colunas explícitas para permitir, no futuro,
-- um worker server-side de alertas por email (plano Pro)
create table if not exists public.alerts (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  coin_id text not null,
  coin_name text,
  coin_image text,
  symbol text,
  direction text not null check (direction in ('above', 'below')),
  target_price double precision not null,
  price_at_creation double precision,
  note text not null default '',
  triggered boolean not null default false,
  triggered_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists alerts_user_idx on public.alerts (user_id);

-- RLS: cada utilizador só lê/escreve as suas próprias linhas
alter table public.watchlist_items enable row level security;
alter table public.alerts enable row level security;

create policy "watchlist: own rows" on public.watchlist_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "alerts: own rows" on public.alerts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
