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
  'nvidia/nemotron-3-super-120b-a12b:free',
  'openai/gpt-oss-120b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'google/gemma-4-31b-it:free',
]

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function fmtPrice(p: number): string {
  if (p == null || isNaN(p)) return '—'
  if (p >= 1000) return '$' + p.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (p >= 1) return '$' + p.toFixed(4)
  return '$' + p.toFixed(6)
}

function buildPrompt(coin: any): string {
  const linhas = [
    `Moeda: ${coin.name} (${(coin.symbol || '').toUpperCase()})`,
    `Preço atual: ${fmtPrice(coin.current_price)}`,
    coin.price_change_percentage_24h != null ? `Variação 24h: ${coin.price_change_percentage_24h.toFixed(2)}%` : null,
    coin.market_cap != null ? `Cap. de mercado: $${Number(coin.market_cap).toLocaleString('pt-PT')}` : null,
    coin.market_cap_rank != null ? `Ranking: #${coin.market_cap_rank}` : null,
  ].filter(Boolean).join('\n')

  return `És um analista de cripto. Com base nos dados abaixo, escreve uma análise CURTA e objetiva em português de Portugal, com exatamente estes 3 tópicos (uma a duas frases cada):
• Momentum: o que o movimento recente sugere
• Contexto: posição no mercado / nível a vigiar
• Risco: o principal risco a ter em conta

Dados:
${linhas}

Regras: máximo ~90 palavras no total, tom neutro e informativo, NÃO dês conselhos de compra/venda. Não inventes dados que não estão acima.`
}

Deno.serve(async (req) => {
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

  // 4. Cache: devolver análise recente (< 1h) se existir
  const { data: cached } = await supabase
    .from('ai_analysis_cache')
    .select('content, created_at')
    .eq('coin_id', coin.id)
    .maybeSingle()
  if (cached && Date.now() - new Date(cached.created_at).getTime() < CACHE_TTL_MS) {
    return json({ analysis: cached.content, cached: true })
  }

  // 5. Chamar o OpenRouter (API compatível com OpenAI), tentando os modelos por ordem
  const prompt = buildPrompt(coin)
  let analysis = ''
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
          max_tokens: 300,
          temperature: 0.5,
        }),
      })
      if (!res.ok) {
        lastDetail = `${m}: ${res.status} ${await res.text()}`.slice(0, 300)
        continue // 429 ou outro erro → tenta o próximo modelo
      }
      const data = await res.json()
      const content = data?.choices?.[0]?.message?.content?.trim()
      if (content) {
        analysis = content
        usedModel = m
        break
      }
      lastDetail = `${m}: resposta vazia`
    } catch (e) {
      lastDetail = `${m}: ${String(e)}`
    }
  }

  if (!analysis) {
    return json({ error: 'Todos os modelos IA estão indisponíveis de momento.', detail: lastDetail }, 502)
  }

  // 6. Guardar no cache (upsert por moeda)
  await supabase
    .from('ai_analysis_cache')
    .upsert({ coin_id: coin.id, content: analysis, model: usedModel, created_at: new Date().toISOString() })

  return json({ analysis, cached: false })
})
