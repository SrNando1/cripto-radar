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

Os campos "curto", "medio" e "longo" têm de ser EXATAMENTE uma destas palavras (sem mais nada): compra, venda, ou neutro.
Só o campo "resumo" contém uma frase.

Devolve APENAS um objeto JSON válido, sem texto à volta, exatamente neste formato:
{"curto":"neutro","medio":"compra","longo":"venda","resumo":"uma frase curta (máx 15 palavras) em português a justificar"}

Dados:
${linhas}

Não inventes dados que não estão acima. Responde só com o JSON.`
}

// Extrai o JSON do texto do modelo e normaliza os sinais.
function parseResult(raw: string): any {
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
  if (obj.curto == null && obj.medio == null && obj.longo == null) return null
  return {
    signals: { curto: norm(obj.curto), medio: norm(obj.medio), longo: norm(obj.longo) },
    resumo: typeof obj.resumo === 'string' ? obj.resumo.slice(0, 200) : '',
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

  // 5. Chamar o OpenRouter (API compatível com OpenAI), tentando os modelos por ordem
  const prompt = buildPrompt(coin)
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
      const data = await res.json()
      const content = data?.choices?.[0]?.message?.content?.trim()
      const parsed = parseResult(content)
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

  if (!result) {
    return json({ error: 'Todos os modelos IA estão indisponíveis de momento.', detail: lastDetail }, 502)
  }

  // 6. Guardar no cache (JSON) e devolver
  await supabase
    .from('ai_analysis_cache')
    .upsert({ coin_id: coin.id, content: JSON.stringify(result), model: usedModel, created_at: new Date().toISOString() })

  return json({ analysis: result, cached: false })
})
