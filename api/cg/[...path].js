// Proxy da CoinGecko com cache de CDN.
// Substitui o rewrite directo: junta a chave demo do lado do servidor e,
// sobretudo, mete cache à resposta (s-maxage) — assim todos os utilizadores
// partilham a mesma resposta e a CoinGecko só é chamada ~1x por intervalo,
// evitando os 403 de rate-limit ao IP da Vercel.

export default async function handler(req, res) {
  // req.url = "/api/cg/coins/markets?vs_currency=usd&..."
  const path = req.url.replace(/^\/api\/cg\//, '')
  const url = new URL(`https://api.coingecko.com/api/v3/${path}`)

  // Chave do lado do servidor (não exposta no browser). Cai para a que vier
  // na query (compat. com dev) se CG_API_KEY não estiver definida.
  const key = process.env.CG_API_KEY
  if (key) url.searchParams.set('x_cg_demo_api_key', key)

  try {
    const upstream = await fetch(url, { headers: { accept: 'application/json' } })
    const body = await upstream.text()

    if (upstream.ok) {
      // Cache no CDN da Vercel: 1ª chamada vai à CoinGecko, as seguintes (30s)
      // são servidas do edge. stale-while-revalidate evita esperas no refresh.
      res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=90')
    }
    res.setHeader('Content-Type', 'application/json')
    return res.status(upstream.status).send(body)
  } catch (e) {
    return res.status(502).json({ error: 'Falha a contactar a CoinGecko', detail: String(e) })
  }
}
