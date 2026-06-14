// Webhook do LemonSqueezy → atualiza o plano do utilizador no Supabase.
// Corre como Vercel Edge Function (precisa do body cru para validar a assinatura).
//
// Variáveis de ambiente necessárias (Vercel → Settings → Environment Variables):
//   LEMONSQUEEZY_WEBHOOK_SECRET  — o "signing secret" definido ao criar o webhook no LS
//   SUPABASE_URL                 — https://<projeto>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    — service role (Project Settings → API) — NUNCA no frontend

export const config = { runtime: 'edge' }

// O nome do produto/variante no LemonSqueezy determina o plano:
// chama aos produtos "CriptoRadar Pro" e "CriptoRadar Trader".
function planFromName(name = '') {
  const n = name.toLowerCase()
  if (n.includes('trader')) return 'trader'
  if (n.includes('pro')) return 'pro'
  return null
}

async function hmacHex(secret, raw) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(raw))
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('')
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret || !supabaseUrl || !serviceKey) {
    return new Response('Server not configured', { status: 500 })
  }

  const raw = await req.text()
  const signature = req.headers.get('x-signature') || ''
  const expected = await hmacHex(secret, raw)
  if (signature !== expected) {
    return new Response('Invalid signature', { status: 401 })
  }

  const payload = JSON.parse(raw)
  const event = payload?.meta?.event_name
  const userId = payload?.meta?.custom_data?.user_id
  // Sem user_id (compra fora da app): aceita e ignora, para o LS não re-tentar
  if (!userId) return new Response('ignored: no user_id', { status: 200 })

  const attrs = payload?.data?.attributes || {}
  let plan = planFromName(`${attrs.product_name || ''} ${attrs.variant_name || ''}`)

  // Subscrição terminada de vez → volta ao Free.
  // ('subscription_cancelled' mantém o acesso até ao fim do período pago.)
  if (event === 'subscription_expired') plan = 'free'
  if (!plan) return new Response('ignored: unknown plan', { status: 200 })

  const res = await fetch(`${supabaseUrl}/rest/v1/profiles?on_conflict=user_id`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify([{
      user_id: userId,
      plan,
      ls_customer_id: String(attrs.customer_id ?? ''),
      ls_subscription_id: String(payload?.data?.id ?? ''),
      updated_at: new Date().toISOString(),
    }]),
  })

  if (!res.ok) {
    const detail = await res.text()
    return new Response(`Supabase error: ${detail}`, { status: 500 })
  }
  return new Response('ok', { status: 200 })
}
