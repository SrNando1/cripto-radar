// Edge Function: análise de uma cripto com IA (via OpenRouter), só para Pro/Trader.
// - Valida o utilizador (JWT) e o plano (tabela profiles)
// - Cache partilhado por moeda (< 1h) → a IA só é chamada quando necessário
//
// Secrets (supabase secrets set ...):
//   OPENROUTER_API_KEY   — chave do OpenRouter (openrouter.ai/keys)
//   OPENROUTER_MODEL     — (opcional) modelo, ex.: "meta-llama/llama-3.3-70b-instruct:free"
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY  — auto-injetados no deploy
//
// Deploy: supabase functions deploy ai-analysis   (com verify_jwt ligado)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hora
// Lista de modelos free (tentados por ordem). Os `:free` do OpenRouter são
// partilhados e ficam frequentemente rate-limited (429) — por isso tentamos
// vários até um responder. Override via OPENROUTER_MODEL (vírgulas).
const DEFAULT_MODELS = [
  'openai/gpt-oss-120b:free',
  'openai/gpt-oss-20b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'google/gemma-4-31b-it:free',
]

// A função é chamada do browser (cross-origin) → precisa de CORS.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function fmtPrice(p: number): string {
  if (p == null || isNaN(p)) return '—'
  if (p >= 1000) return '$' + p.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (p >= 1) return '$' + p.toFixed(4)
  return '$' + p.toFixed(6)
}

function fmtPct(v: number): string {
  if (v == null || isNaN(v)) return 'n/d'
  return `${v >= 0 ? '+' : ''}${Number(v).toFixed(1)}%`
}

function buildPrompt(coin: any): string {
  const linhas = [
    `Moeda: ${coin.name} (${(coin.symbol || '').toUpperCase()})`,
    `Preço: ${fmtPrice(coin.current_price)}`,
    `Variação 24h: ${fmtPct(coin.change_24h)}`,
    `Variação 7 dias: ${fmtPct(coin.change_7d)}`,
    `Variação 30 dias: ${fmtPct(coin.change_30d)}`,
    coin.market_cap_rank != null ? `Ranking de mercado: #${coin.market_cap_rank}` : null,
  ].filter(Boolean).join('\n')

  return `És um analista de cripto. Com base nos dados abaixo, indica a TENDÊNCIA de investimento para 3 horizontes:
- curto: dias (baseia-te sobretudo na variação 24h e 7 dias)
- medio: semanas (variação 7 e 30 dias)
- longo: meses (variação 30 dias e posição no mercado)

Para cada horizonte devolve o SINAL (compra, venda ou neutro) e um ALVO de preço em USD (número):
- compra → alvo = preço ABAIXO do atual onde faz sentido comprar/acumular
- venda → alvo = preço ACIMA do atual onde faz sentido vender/realizar
- neutro → alvo = null
Alvos do curto prazo ficam perto do preço atual; os do longo mais afastados. Baseia-te no preço e nas variações.
Evita "neutro" quando a variação de um horizonte for claramente positiva (tende a compra) ou negativa (tende a venda); usa "neutro" só quando os sinais forem mesmo mistos.

Devolve APENAS um objeto JSON válido, sem texto à volta, exatamente neste formato:
{"curto":{"sinal":"compra","alvo":58500},"medio":{"sinal":"neutro","alvo":null},"longo":{"sinal":"venda","alvo":72000},"resumo":"uma frase curta (máx 15 palavras) em português"}

Dados:
${linhas}

Não inventes dados que não estão acima. Responde só com o JSON.`
}

// Extrai o JSON do modelo, normaliza os sinais e valida/calcula os alvos.
const BANDS: Record<string, number> = { curto: 0.03, medio: 0.07, longo: 0.15 }

function parseResult(raw: string, current: number): any {
  let s = (raw || '').replace(/```json/gi, '').replace(/```/g, '').trim()
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  let obj: any
  try {
    obj = JSON.parse(s.slice(start, end + 1))
  } catch {
    return null
  }
  const norm = (v: any) => {
    const x = String(v || '').toLowerCase()
    if (x.includes('compra')) return 'compra'
    if (x.includes('venda')) return 'venda'
    return 'neutro'
  }
  // Aceita cada horizonte como objeto {sinal, alvo} ou como string (só sinal).
  const horiz = (key: string) => {
    const v = obj[key]
    const sinal = norm(v && typeof v === 'object' ? v.sinal : v)
    let alvo: number | null = v && typeof v === 'object' ? Number(v.alvo) : NaN
    const a = alvo as number
    // Alvo válido só se estiver do lado certo: compra ABAIXO do atual, venda ACIMA (dentro de ±50%).
    const sane = current > 0 && isFinite(a) && (
      (sinal === 'compra' && a < current && a > current * 0.5) ||
      (sinal === 'venda' && a > current && a < current * 1.5)
    )
    if (sinal === 'neutro') alvo = null
    else if (!sane) {
      // fallback determinístico a partir do preço atual + banda do horizonte
      const b = BANDS[key]
      alvo = sinal === 'compra' ? current * (1 - b) : current * (1 + b)
    }
    return { sinal, alvo }
  }
  if (obj.curto == null && obj.medio == null && obj.longo == null) return null
  return {
    signals: { curto: horiz('curto'), medio: horiz('medio'), longo: horiz('longo') },
    resumo: typeof obj.resumo === 'string' ? obj.resumo.slice(0, 200) : '',
  }
}

// Fallback por regras (quando todos os modelos IA falham): sinais a partir das
// variações reais, seguindo a tendência (subir → compra, descer → venda).
function ruleResult(data: any): any {
  const price = Number(data.current_price) || 0
  const sig = (change: number, thresh: number) => {
    if (change == null || isNaN(change)) return 'neutro'
    if (change >= thresh) return 'compra'
    if (change <= -thresh) return 'venda'
    return 'neutro'
  }
  const mk = (sinal: string, band: number) => ({
    sinal,
    alvo: sinal === 'neutro' ? null : (sinal === 'compra' ? price * (1 - band) : price * (1 + band)),
  })
  return {
    signals: {
      curto: mk(sig(data.change_24h, 3), BANDS.curto),
      medio: mk(sig(data.change_7d, 5), BANDS.medio),
      longo: mk(sig(data.change_30d, 8), BANDS.longo),
    },
    resumo: 'Tendência estimada a partir das variações de 24h, 7 e 30 dias.',
  }
}

Deno.serve(async (req) => {
  // Preflight CORS do browser
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const orKey = Deno.env.get('OPENROUTER_API_KEY')
  const envModels = Deno.env.get('OPENROUTER_MODEL')
  const models = envModels ? envModels.split(',').map((s) => s.trim()) : DEFAULT_MODELS
  if (!orKey) return json({ error: 'OPENROUTER_API_KEY em falta' }, 500)

  const supabase = createClient(supabaseUrl, serviceKey)

  // 1. Identificar o utilizador a partir do JWT
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '')
  const { data: userData } = await supabase.auth.getUser(token)
  const user = userData?.user
  if (!user) return json({ error: 'Não autenticado' }, 401)

  // 2. Garantir que é Pro/Trader (feature paga)
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!profile || profile.plan === 'free') {
    return json({ error: 'Funcionalidade exclusiva do plano Pro' }, 403)
  }

  // 3. Ler o pedido
  let coin: any
  try {
    const body = await req.json()
    coin = body?.coin
  } catch {
    return json({ error: 'Corpo inválido' }, 400)
  }
  if (!coin?.id) return json({ error: 'Falta a moeda' }, 400)

  // 4. Cache: devolver tendência recente (< 1h) se existir e for válida
  const { data: cached } = await supabase
    .from('ai_analysis_cache')
    .select('content, created_at')
    .eq('coin_id', coin.id)
    .maybeSingle()
  if (cached && Date.now() - new Date(cached.created_at).getTime() < CACHE_TTL_MS) {
    try {
      const parsed = JSON.parse(cached.content)
      if (parsed?.signals) return json({ analysis: parsed, cached: true })
    } catch { /* formato antigo → regenerar */ }
  }

  // 4b. Buscar dados de mercado autoritativos (24h/7d/30d) à CoinGecko —
  //     não dependemos do que o cliente enviou.
  const cgKey = Deno.env.get('CG_API_KEY')
  let data = coin
  try {
    const cgUrl = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coin.id}&price_change_percentage=24h,7d,30d` +
      (cgKey ? `&x_cg_demo_api_key=${cgKey}` : '')
    const cgRes = await fetch(cgUrl, { headers: { accept: 'application/json' } })
    const arr = cgRes.ok ? await cgRes.json() : null
    const m = Array.isArray(arr) && arr[0] ? arr[0] : null
    if (m) {
      data = {
        id: m.id,
        name: m.name,
        symbol: m.symbol,
        current_price: m.current_price,
        change_24h: m.price_change_percentage_24h_in_currency ?? m.price_change_percentage_24h,
        change_7d: m.price_change_percentage_7d_in_currency,
        change_30d: m.price_change_percentage_30d_in_currency,
        market_cap_rank: m.market_cap_rank,
      }
    }
  } catch { /* usa o que veio do cliente */ }

  // 5. Chamar o OpenRouter (API compatível com OpenAI), tentando os modelos por ordem
  const prompt = buildPrompt(data)
  let result: any = null
  let usedModel = ''
  let lastDetail = ''
  for (const m of models) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${orKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://cripto-radar.vercel.app',
          'X-Title': 'CriptoRadar',
        },
        body: JSON.stringify({
          model: m,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 200,
          temperature: 0.3,
        }),
      })
      if (!res.ok) {
        lastDetail = `${m}: ${res.status} ${await res.text()}`.slice(0, 300)
        continue // 429 ou outro erro → tenta o próximo modelo
      }
      const apiData = await res.json()
      const content = apiData?.choices?.[0]?.message?.content?.trim()
      const parsed = parseResult(content, Number(data.current_price))
      if (parsed) {
        result = parsed
        usedModel = m
        break
      }
      lastDetail = `${m}: JSON inválido`
    } catch (e) {
      lastDetail = `${m}: ${String(e)}`
    }
  }

  // Se todos os modelos IA falharam, recorre às regras — a feature nunca fica indisponível.
  if (!result) {
    result = ruleResult(data)
    usedModel = 'regras'
  }

  // 6. Guardar no cache (JSON) e devolver
  await supabase
    .from('ai_analysis_cache')
    .upsert({ coin_id: coin.id, content: JSON.stringify(result), model: usedModel, created_at: new Date().toISOString() })

  return json({ analysis: result, cached: false })
})
