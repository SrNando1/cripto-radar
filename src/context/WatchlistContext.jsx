import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { useAuth } from './AuthContext'

const WatchlistContext = createContext()
const STORAGE_KEY = 'cripto-watchlist'
const OWNER_KEY = 'cripto-watchlist-owner' // 'guest' | <userId> — de quem são os dados locais

const logSync = (op) => ({ error }) => {
  if (error) console.warn(`[sync watchlist] ${op}:`, error.message)
}

export function WatchlistProvider({ children }) {
  const { user, loading } = useAuth()
  const [watchlist, setWatchlist] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  })
  const [synced, setSynced] = useState(false)

  // localStorage é sempre o espelho local (funciona offline e sem conta)
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist))
  }, [watchlist])

  useEffect(() => {
    // Espera a auth resolver para não agir com estado indefinido
    if (!supabase || loading) return

    // Sem sessão
    if (!user) {
      // Se os dados locais eram de uma conta (não convidado), limpa-os para
      // não vazarem para a próxima conta que iniciar sessão neste browser.
      const prevOwner = localStorage.getItem(OWNER_KEY)
      if (prevOwner && prevOwner !== 'guest') {
        setWatchlist([])
        localStorage.setItem(OWNER_KEY, 'guest')
      }
      setSynced(false)
      return
    }

    // Com sessão: a cloud é a fonte de verdade
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

      // Só fundir dados locais se forem EXPLICITAMENTE de convidado.
      // (owner ausente = origem desconhecida → não fundir, evita vazar dados
      // antigos de outra conta que ficaram no localStorage.)
      const prevOwner = localStorage.getItem(OWNER_KEY)
      let toPush = []
      if (prevOwner === 'guest') {
        const local = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
        toPush = local.filter(c => !cloudIds.has(c.id))
        if (toPush.length) {
          supabase
            .from('watchlist_items')
            .upsert(toPush.map(c => ({ user_id: user.id, coin_id: c.id, coin: c })))
            .then(logSync('merge'))
        }
      }

      if (cancelled) return
      setWatchlist([...cloud, ...toPush])
      localStorage.setItem(OWNER_KEY, user.id)
      setSynced(true)
    })()
    return () => { cancelled = true }
  }, [user, loading])

  const addToWatchlist = (coin) => {
    setWatchlist(prev => [...prev, coin])
    if (user && supabase) {
      supabase
        .from('watchlist_items')
        .upsert({ user_id: user.id, coin_id: coin.id, coin })
        .then(logSync('add'))
    } else {
      // Convidado: marca os dados como tal, para migrarem ao iniciar sessão
      localStorage.setItem(OWNER_KEY, 'guest')
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
