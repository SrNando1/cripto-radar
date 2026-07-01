-- Portfolio (posições do utilizador) — Correr no SQL Editor do Supabase
-- Permite VÁRIOS registos (lotes) por moeda, comprados a preços diferentes.
-- Recria a tabela (a chave primária mudou de (user_id,coin_id) para id único).

drop table if exists public.portfolio_items cascade;

create table public.portfolio_items (
  id text primary key,                        -- id único do lote
  user_id uuid not null references auth.users(id) on delete cascade,
  coin_id text not null,
  coin jsonb not null default '{}'::jsonb,     -- snapshot (nome, símbolo, imagem)
  quantity double precision not null default 0,
  buy_price double precision not null default 0,  -- preço de compra (USD)
  created_at timestamptz not null default now()
);

create index if not exists portfolio_user_idx on public.portfolio_items (user_id);

alter table public.portfolio_items enable row level security;

create policy "portfolio: own rows" on public.portfolio_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
