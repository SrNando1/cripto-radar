import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { useAuth } from './AuthContext'

const PortfolioContext = createContext()
const STORAGE_KEY = 'cripto-portfolio'
const OWNER_KEY = 'cripto-portfolio-owner' // 'guest' | <userId>

const logSync = (op) => ({ error }) => {
  if (error) console.warn(`[sync portfolio] ${op}:`, error.message)
}

function rowToItem(r) {
  return { ...r.coin, id: r.coin_id, quantity: r.quantity, buyPrice: r.buy_price }
}
function itemToRow(it, userId) {
  return {
    user_id: userId,
    coin_id: it.id,
    coin: { id: it.id, name: it.name, symbol: it.symbol, image: it.image },
    quantity: it.quantity,
    buy_price: it.buyPrice,
  }
}

export function PortfolioProvider({ children }) {
  const { user, loading } = useAuth()
  const [holdings, setHoldings] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings))
  }, [holdings])

  useEffect(() => {
    if (!supabase || loading) return
    if (!user) {
      const prevOwner = localStorage.getItem(OWNER_KEY)
      if (prevOwner && prevOwner !== 'guest') {
        setHoldings([])
        localStorage.setItem(OWNER_KEY, 'guest')
      }
      return
    }
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase.from('portfolio_items').select('*')
      if (error) { console.warn('[sync portfolio] load:', error.message); return }
      if (cancelled) return
      const cloud = data.map(rowToItem)
      const cloudIds = new Set(cloud.map(c => c.id))
      const prevOwner = localStorage.getItem(OWNER_KEY)
      let toPush = []
      if (prevOwner === 'guest') {
        const local = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
        toPush = local.filter(c => !cloudIds.has(c.id))
        if (toPush.length) {
          supabase.from('portfolio_items').upsert(toPush.map(c => itemToRow(c, user.id))).then(logSync('merge'))
        }
      }
      if (cancelled) return
      setHoldings([...cloud, ...toPush])
      localStorage.setItem(OWNER_KEY, user.id)
    })()
    return () => { cancelled = true }
  }, [user, loading])

  const addHolding = (coin, quantity, buyPrice) => {
    const it = { id: coin.id, name: coin.name, symbol: coin.symbol, image: coin.image, quantity, buyPrice }
    setHoldings(prev => {
      const rest = prev.filter(h => h.id !== coin.id)
      return [...rest, it]
    })
    if (user && supabase) supabase.from('portfolio_items').upsert(itemToRow(it, user.id)).then(logSync('add'))
    else localStorage.setItem(OWNER_KEY, 'guest')
  }

  const removeHolding = (coinId) => {
    setHoldings(prev => prev.filter(h => h.id !== coinId))
    if (user && supabase) {
      supabase.from('portfolio_items').delete().eq('user_id', user.id).eq('coin_id', coinId).then(logSync('remove'))
    }
  }

  const hasHolding = (coinId) => holdings.some(h => h.id === coinId)

  return (
    <PortfolioContext.Provider value={{ holdings, addHolding, removeHolding, hasHolding }}>
      {children}
    </PortfolioContext.Provider>
  )
}

export function usePortfolio() {
  return useContext(PortfolioContext)
}
