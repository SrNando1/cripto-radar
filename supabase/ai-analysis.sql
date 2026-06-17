-- Análise com IA — cache partilhado (Pro)
-- Correr no Supabase: SQL Editor → New query → colar → Run

-- Cache da análise por moeda. Partilhado por todos os utilizadores: a IA só é
-- chamada quando não há análise recente (< 1h) para a moeda → custo mínimo.
create table if not exists public.ai_analysis_cache (
  coin_id text primary key,
  content text not null,
  model text,
  created_at timestamptz not null default now()
);

-- RLS ligado sem policies: só a Edge Function (service role) lê/escreve.
-- O cliente nunca toca nesta tabela diretamente — recebe a análise pela função.
alter table public.ai_analysis_cache enable row level security;
