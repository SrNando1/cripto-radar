import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { useAuth } from './AuthContext'

const WatchlistContext = createContext()
const STORAGE_KEY = 'cripto-watchlist'

const logSync = (op) => ({ error }) => {
  if (error) console.warn(`[sync watchlist] ${op}:`, error.message)
}

export function WatchlistProvider({ children }) {
  const { user } = useAuth()
  const [watchlist, setWatchlist] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  })
  const [synced, setSynced] = useState(false)

  // localStorage é sempre o espelho local (funciona offline e sem conta)
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist))
  }, [watchlist])

  // Ao iniciar sessão: carrega da cloud e envia as moedas locais que lá faltem
  useEffect(() => {
    if (!user || !supabase) {
      setSynced(false)
      return
    }
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('watchlist_items')
        .select('coin')
        .order('created_at', { ascending: true })
      if (error) {
        console.warn('[sync watchlist] load:', error.message)
        return
      }
      if (cancelled) return
      const cloud = data.map(r => r.coin)
      const cloudIds = new Set(cloud.map(c => c.id))
      const local = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      const toPush = local.filter(c => !cloudIds.has(c.id))
      if (toPush.length) {
        supabase
          .from('watchlist_items')
          .upsert(toPush.map(c => ({ user_id: user.id, coin_id: c.id, coin: c })))
          .then(logSync('merge'))
      }
      setWatchlist([...cloud, ...toPush])
      setSynced(true)
    })()
    return () => { cancelled = true }
  }, [user])

  const addToWatchlist = (coin) => {
    setWatchlist(prev => [...prev, coin])
    if (user && supabase) {
      supabase
        .from('watchlist_items')
        .upsert({ user_id: user.id, coin_id: coin.id, coin })
        .then(logSync('add'))
    }
  }

  const removeFromWatchlist = (coinId) => {
    setWatchlist(prev => prev.filter(c => c.id !== coinId))
    if (user && supabase) {
      supabase
        .from('watchlist_items')
        .delete()
        .eq('user_id', user.id)
        .eq('coin_id', coinId)
        .then(logSync('remove'))
    }
  }

  const isInWatchlist = (coinId) => watchlist.some(c => c.id === coinId)

  return (
    <WatchlistContext.Provider value={{ watchlist, addToWatchlist, removeFromWatchlist, isInWatchlist, synced }}>
      {children}
    </WatchlistContext.Provider>
  )
}

export function useWatchlist() {
  return useContext(WatchlistContext)
}
