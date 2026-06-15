-- Fase 5 — Alertas por email
-- Correr no Supabase: SQL Editor → New query → colar → Run

-- 1. Opt-in de email por alerta (só Pro/Trader o ativam na app)
alter table public.alerts
  add column if not exists notify_email boolean not null default false;

-- 1b. Flag do canal de email (independente de 'triggered', que é do browser).
--     Garante que o email é enviado mesmo que o browser já tenha acionado o alerta.
alter table public.alerts
  add column if not exists email_sent boolean not null default false;

-- 2. Agendar a Edge Function de 5 em 5 minutos.
--    Requer as extensões pg_cron e pg_net (Database → Extensions → ativar ambas).
--    Substitui <PROJ> e <SERVICE_ROLE_KEY> pelos valores do teu projeto.
--
-- select cron.schedule(
--   'check-alerts-every-5min',
--   '*/5 * * * *',
--   $$
--   select net.http_post(
--     url     := 'https://<PROJ>.supabase.co/functions/v1/check-alerts',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
--       'Content-Type', 'application/json'
--     )
--   );
--   $$
-- );
--
-- Para remover o agendamento mais tarde:
-- select cron.unschedule('check-alerts-every-5min');
