// Edge Function: verifica alertas com email ligado e envia notificação via Resend.
// Pensada para correr num cron de 5 em 5 min (ver supabase/email-alerts.sql).
//
// Secrets necessários (supabase secrets set ...):
//   SUPABASE_URL                — injetado automaticamente pelo runtime
//   SUPABASE_SERVICE_ROLE_KEY   — injetado automaticamente pelo runtime
//   RESEND_API_KEY              — chave da Resend (resend.com/api-keys)
//   ALERT_FROM_EMAIL            — remetente verificado, ex.: "CriptoRadar <alertas@teudominio.pt>"
//   CG_API_KEY                  — (opcional) chave demo da CoinGecko, evita 429
//
// Deploy: supabase functions deploy check-alerts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function fmtPrice(p: number): string {
  if (p == null || isNaN(p)) return '—'
  if (p >= 1000) return '$' + p.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (p >= 1) return '$' + p.toFixed(4)
  return '$' + p.toFixed(6)
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function sendEmail(to: string, alert: any, price: number): Promise<boolean> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('ALERT_FROM_EMAIL') ?? 'CriptoRadar <onboarding@resend.dev>'
  if (!apiKey) return 'no RESEND_API_KEY'

  const dir = alert.direction === 'above' ? 'subiu acima de' : 'desceu abaixo de'
  const subject = `🔔 ${alert.coin_name} ${dir} ${fmtPrice(alert.target_price)}`
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0d0d0d;border-radius:16px;color:#eee">
      <div style="font-size:13px;color:#1D9E75;font-family:monospace;letter-spacing:.08em">CRIPTORADAR</div>
      <h2 style="font-size:20px;margin:16px 0 8px">${alert.coin_name} ${dir} ${fmtPrice(alert.target_price)}</h2>
      <p style="color:#999;font-size:14px;margin:0 0 16px">Preço atual: <b style="color:#eee">${fmtPrice(price)}</b></p>
      ${alert.note ? `<p style="color:#888;font-size:13px;font-style:italic">${alert.note}</p>` : ''}
      <p style="color:#555;font-size:12px;margin-top:24px">Recebeste este email porque tens um alerta de preço ativo no CriptoRadar.</p>
    </div>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html }),
  })
  if (!res.ok) return `resend ${res.status}: ${await res.text()}`
  return null // sucesso
}

Deno.serve(async (req) => {
  // Proteção: o cron tem de enviar o header x-cron-secret igual ao CRON_SECRET.
  // (A função está deployed com --no-verify-jwt, por isso a guarda é aqui.)
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (cronSecret && req.headers.get('x-cron-secret') !== cronSecret) {
    return json({ error: 'unauthorized' }, 401)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // 1. Alertas com email ligado ainda por enviar.
  //    Usa email_sent (independente de 'triggered', que é do canal do browser),
  //    para o email funcionar mesmo que o browser já tenha acionado o alerta.
  const { data: alerts, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('notify_email', true)
    .eq('email_sent', false)
  if (error) return json({ error: error.message }, 500)
  if (!alerts?.length) return json({ checked: 0, sent: 0 })

  // 2. Manter só os de utilizadores Pro/Trader (email é feature paga)
  const userIds = [...new Set(alerts.map((a) => a.user_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, plan')
    .in('user_id', userIds)
  const paid = new Set((profiles ?? []).filter((p) => p.plan !== 'free').map((p) => p.user_id))
  const eligible = alerts.filter((a) => paid.has(a.user_id))
  if (!eligible.length) return json({ checked: alerts.length, sent: 0 })

  // 3. Preços atuais (uma chamada à CoinGecko para todas as moedas)
  const ids = [...new Set(eligible.map((a) => a.coin_id))].join(',')
  const cgKey = Deno.env.get('CG_API_KEY')
  const cgUrl = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}` +
    (cgKey ? `&x_cg_demo_api_key=${cgKey}` : '')
  const markets = await fetch(cgUrl).then((r) => r.json())
  if (!Array.isArray(markets)) return json({ error: 'CoinGecko indisponível', detail: markets }, 502)
  const priceById = new Map(markets.map((c: any) => [c.id, c.current_price]))

  // 4. Verificar condições, enviar email e marcar email_sent
  let sent = 0
  for (const a of eligible) {
    const price = priceById.get(a.coin_id)
    if (price == null) continue
    const hit = a.direction === 'above' ? price >= a.target_price : price <= a.target_price
    if (!hit) continue

    const { data: u } = await supabase.auth.admin.getUserById(a.user_id)
    const email = u?.user?.email
    if (!email) continue

    const sendErr = await sendEmail(email, a, price)
    if (sendErr) {
      console.error('[check-alerts]', a.id, sendErr)
      continue
    }
    sent++
    await supabase.from('alerts').update({ email_sent: true }).eq('id', a.id)
  }

  return json({ checked: eligible.length, sent })
})
