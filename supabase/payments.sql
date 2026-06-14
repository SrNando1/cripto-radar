-- Pagamentos: plano de cada utilizador
-- Correr no Supabase: SQL Editor → New query → colar → Run

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro', 'trader')),
  ls_customer_id text,
  ls_subscription_id text,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- O utilizador só LÊ o seu plano. Não há policy de escrita:
-- apenas o webhook (service role, ignora RLS) pode alterar planos.
create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = user_id);
