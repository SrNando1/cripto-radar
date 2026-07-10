import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { fetchCoins, fetchGlobalData } from '../services/api'
import { usePlan } from './PlanContext'
import { getLimits } from '../config/plans'

const CoinsContext = createContext()

export function CoinsProvider({ children }) {
  const { plan } = usePlan()
  const { refreshMs, coinsMax } = getLimits(plan)
  const [coins, setCoins] = useState([])
  const [globalData, setGlobalData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  // Preços do refresh anterior, para calcular a variação "desde a última atualização"
  const prevPrices = useRef({})

  const load = useCallback(async () => {
    try {
      const [coinsData, global] = await Promise.all([
        fetchCoins(1, coinsMax),
        fetchGlobalData()
      ])
      // Enriquece cada moeda com a variação (%) face ao preço do refresh anterior
      const enriched = coinsData.map(c => {
        const prev = prevPrices.current[c.id]
        const tickChange = prev != null && prev > 0
          ? ((c.current_price - prev) / prev) * 100
          : null
        return { ...c, tickChange }
      })
      prevPrices.current = Object.fromEntries(coinsData.map(c => [c.id, c.current_price]))
      setCoins(enriched)
      setGlobalData(global)
      setLastUpdate(new Date())
      setError(null)
    } catch (e) {
      setError(e?.message || 'Erro ao carregar dados. Verifica a tua ligação.')
    } finally {
      setLoading(false)
    }
  }, [coinsMax])

  useEffect(() => {
    load()
    const interval = setInterval(load, refreshMs)
    return () => clearInterval(interval)
  }, [load, refreshMs])

  return (
    <CoinsContext.Provider value={{ coins, globalData, loading, error, lastUpdate, refresh: load, refreshMs }}>
      {children}
    </CoinsContext.Provider>
  )
}

export function useCoins() {
  return useContext(CoinsContext)
}
