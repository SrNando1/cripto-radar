-- Portfolio (posições do utilizador) — Correr no SQL Editor do Supabase

create table if not exists public.portfolio_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  coin_id text not null,
  coin jsonb not null default '{}'::jsonb,   -- snapshot (nome, símbolo, imagem)
  quantity double precision not null default 0,
  buy_price double precision not null default 0,  -- preço médio de compra (USD)
  created_at timestamptz not null default now(),
  primary key (user_id, coin_id)
);

alter table public.portfolio_items enable row level security;

create policy "portfolio: own rows" on public.portfolio_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
