import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { fetchCoins, fetchGlobalData } from '../services/api'
import { usePlan } from './PlanContext'
import { getLimits } from '../config/plans'

const CoinsContext = createContext()

export function CoinsProvider({ children }) {
  const { plan } = usePlan()
  const refreshMs = getLimits(plan).refreshMs
  const [coins, setCoins] = useState([])
  const [globalData, setGlobalData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)

  const load = useCallback(async () => {
    try {
      const [coinsData, global] = await Promise.all([
        fetchCoins(),
        fetchGlobalData()
      ])
      setCoins(coinsData)
      setGlobalData(global)
      setLastUpdate(new Date())
      setError(null)
    } catch (e) {
      setError(e?.message || 'Erro ao carregar dados. Verifica a tua ligação.')
    } finally {
      setLoading(false)
    }
  }, [])

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
