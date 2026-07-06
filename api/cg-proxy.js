// Proxy da CoinGecko com cache de CDN.
// Recebe os pedidos via rewrite no vercel.json: /api/cg/<path> → /api/cg-proxy?cgpath=<path>
// Junta a chave demo do lado do servidor e mete cache à resposta (s-maxage),
// para que todos os utilizadores partilhem a mesma resposta e a CoinGecko só
// seja chamada ~1x por intervalo — evitando os 403 de rate-limit ao IP da Vercel.

export default async function handler(req, res) {
  const { cgpath, ...query } = req.query
  const path = Array.isArray(cgpath) ? cgpath.join('/') : (cgpath || '')

  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    params.set(k, Array.isArray(v) ? v[0] : v)
  }
  // Chave do lado do servidor (sobrepõe qualquer que venha do cliente)
  const key = process.env.CG_API_KEY
  if (key) params.set('x_cg_demo_api_key', key)

  const target = `https://api.coingecko.com/api/v3/${path}?${params.toString()}`

  try {
    const upstream = await fetch(target, { headers: { accept: 'application/json' } })
    const body = await upstream.text()
    if (upstream.ok) {
      // Cache curto (10s) para o refresh de 10s do Pro devolver dados frescos;
      // ainda assim colapsa os pedidos de todos os utilizadores em ~1/10s à CoinGecko.
      res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=30')
    }
    res.setHeader('Content-Type', 'application/json')
    return res.status(upstream.status).send(body)
  } catch (e) {
    return res.status(502).json({ error: 'Falha a contactar a CoinGecko', detail: String(e) })
  }
}
