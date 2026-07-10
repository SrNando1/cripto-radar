import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { fetchCoins, fetchGlobalData } from '../services/api'
import { subscribeLivePrices } from '../services/binanceStream'
import { usePlan } from './PlanContext'
import { getLimits } from '../config/plans'

const CoinsContext = createContext()

export function CoinsProvider({ children }) {
  const { plan } = usePlan()
  const { refreshMs, coinsMax, livePrices } = getLimits(plan)
  const [coins, setCoins] = useState([])
  const [globalData, setGlobalData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [live, setLive] = useState(false) // recebeu pelo menos um preço da Binance

  // Dados-base do CoinGecko (ranking, market cap, 24h, imagens) — a estrutura do mercado.
  const baseCoins = useRef([])
  // Últimos preços ao vivo da Binance: { 'BTCUSDT': 63000.12 }
  const liveMap = useRef({})
  // Preços mostrados no render anterior, para a diferença "desde a última atualização".
  const prevPrices = useRef({})

  // Combina a base do CoinGecko com o preço ao vivo da Binance (quando existe par USDT)
  // e calcula a diferença ($) face ao valor mostrado anteriormente.
  const buildCoins = useCallback(() => {
    const merged = baseCoins.current.map(c => {
      const bSym = c.symbol.toUpperCase() + 'USDT'
      const livePrice = liveMap.current[bSym]
      const price = livePrice != null ? livePrice : c.current_price
      const prev = prevPrices.current[c.id]
      const tickChange = prev != null ? price - prev : null
      prevPrices.current[c.id] = price
      return livePrice != null ? { ...c, current_price: price, tickChange } : { ...c, tickChange }
    })
    setCoins(merged)
  }, [])

  const load = useCallback(async () => {
    try {
      const [coinsData, global] = await Promise.all([
        fetchCoins(1, coinsMax),
        fetchGlobalData()
      ])
      baseCoins.current = coinsData
      buildCoins()
      setGlobalData(global)
      setLastUpdate(new Date())
      setError(null)
    } catch (e) {
      setError(e?.message || 'Erro ao carregar dados. Verifica a tua ligação.')
    } finally {
      setLoading(false)
    }
  }, [coinsMax, buildCoins])

  useEffect(() => {
    load()
    const interval = setInterval(load, refreshMs)
    return () => clearInterval(interval)
  }, [load, refreshMs])

  // Preços ao vivo da Binance — só nos planos com essa capacidade (Trader).
  useEffect(() => {
    if (!livePrices) {
      liveMap.current = {}
      setLive(false)
      return
    }
    const unsub = subscribeLivePrices((map) => {
      liveMap.current = map
      setLive(true)
      setLastUpdate(new Date())
      buildCoins()
    })
    return () => { unsub(); setLive(false) }
  }, [livePrices, buildCoins])

  return (
    <CoinsContext.Provider value={{ coins, globalData, loading, error, lastUpdate, refresh: load, refreshMs, live }}>
      {children}
    </CoinsContext.Provider>
  )
}

export function useCoins() {
  return useContext(CoinsContext)
}
