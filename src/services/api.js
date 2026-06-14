// Pedidos passam por um proxy de mesma origem para evitar o bloqueio de CORS
// da CoinGecko: em dev é o proxy do Vite, em produção os rewrites do vercel.json.
const BASE_URL = '/api/cg'

// Chave demo gratuita da CoinGecko (opcional, mas recomendada para evitar 429).
// Cria uma em https://www.coingecko.com/en/developers/dashboard e coloca em .env:
//   VITE_CG_API_KEY=CG-xxxxxxxx
const API_KEY = import.meta.env.VITE_CG_API_KEY

function withKey(url) {
  if (!API_KEY) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}x_cg_demo_api_key=${API_KEY}`
}

async function get(path) {
  const res = await fetch(withKey(`${BASE_URL}${path}`))
  if (res.status === 429) {
    throw new Error('Limite de pedidos da CoinGecko atingido. Tenta novamente em instantes.')
  }
  if (!res.ok) {
    throw new Error(`Erro ${res.status} ao contactar a CoinGecko.`)
  }
  return res.json()
}

export async function fetchGlobalData() {
  const data = await get('/global')
  return data.data
}

export async function fetchCoins(page = 1, perPage = 20) {
  return get(`/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=${page}&sparkline=false`)
}

export async function fetchCoinChart(coinId, days = 7) {
  return get(`/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`)
}

export async function fetchCoinDetail(coinId) {
  return get(`/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`)
}
