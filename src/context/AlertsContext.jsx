import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabase'
import { useAuth } from './AuthContext'

const AlertsContext = createContext()
const STORAGE_KEY = 'cripto-alerts'

const logSync = (op) => ({ error }) => {
  if (error) console.warn(`[sync alerts] ${op}:`, error.message)
}

// Mapeamento app (camelCase) ↔ colunas SQL (snake_case)
function rowToAlert(r) {
  return {
    id: r.id,
    coinId: r.coin_id,
    coinName: r.coin_name,
    coinImage: r.coin_image,
    symbol: r.symbol,
    direction: r.direction,
    targetPrice: r.target_price,
    priceAtCreation: r.price_at_creation,
    note: r.note || '',
    notifyEmail: r.notify_email || false,
    triggered: r.triggered,
    triggeredAt: r.triggered_at ? new Date(r.triggered_at).getTime() : null,
    createdAt: new Date(r.created_at).getTime(),
  }
}

function alertToRow(a, userId) {
  return {
    id: a.id,
    user_id: userId,
    coin_id: a.coinId,
    coin_name: a.coinName,
    coin_image: a.coinImage,
    symbol: a.symbol,
    direction: a.direction,
    target_price: a.targetPrice,
    price_at_creation: a.priceAtCreation,
    note: a.note || '',
    notify_email: a.notifyEmail || false,
    triggered: a.triggered,
    triggered_at: a.triggeredAt ? new Date(a.triggeredAt).toISOString() : null,
    created_at: new Date(a.createdAt).toISOString(),
  }
}

export function AlertsProvider({ children }) {
  const { user } = useAuth()
  const [alerts, setAlerts] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  })
  const [synced, setSynced] = useState(false)

  // localStorage é sempre o espelho local (funciona offline e sem conta)
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts))
  }, [alerts])

  // Ao iniciar sessão: carrega da cloud e envia os alertas locais que lá faltem
  useEffect(() => {
    if (!user || !supabase) {
      setSynced(false)
      return
    }
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase.from('alerts').select('*')
      if (error) {
        console.warn('[sync alerts] load:', error.message)
        return
      }
      if (cancelled) return
      const cloud = data.map(rowToAlert)
      const cloudIds = new Set(cloud.map(a => a.id))
      const local = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      const toPush = local.filter(a => !cloudIds.has(a.id))
      if (toPush.length) {
        supabase
          .from('alerts')
          .upsert(toPush.map(a => alertToRow(a, user.id)))
          .then(logSync('merge'))
      }
      const merged = [...cloud, ...toPush].sort((a, b) => b.createdAt - a.createdAt)
      setAlerts(merged)
      setSynced(true)
    })()
    return () => { cancelled = true }
  }, [user])

  const addAlert = useCallback((alert) => {
    const novo = {
      id: `${alert.coinId}-${Date.now()}`,
      coinId: alert.coinId,
      coinName: alert.coinName,
      coinImage: alert.coinImage,
      symbol: alert.symbol,
      direction: alert.direction, // 'above' | 'below'
      targetPrice: alert.targetPrice,
      priceAtCreation: alert.priceAtCreation,
      note: alert.note?.trim() || '',
      notifyEmail: alert.notifyEmail || false,
      createdAt: Date.now(),
      triggered: false,
      triggeredAt: null,
    }
    setAlerts(prev => [novo, ...prev])
    if (user && supabase) {
      supabase.from('alerts').insert(alertToRow(novo, user.id)).then(logSync('add'))
    }
  }, [user])

  const removeAlert = useCallback((id) => {
    setAlerts(prev => prev.filter(a => a.id !== id))
    if (user && supabase) {
      supabase.from('alerts').delete().eq('id', id).then(logSync('remove'))
    }
  }, [user])

  const markTriggered = useCallback((id) => {
    const triggeredAt = Date.now()
    setAlerts(prev => prev.map(a =>
      a.id === id ? { ...a, triggered: true, triggeredAt } : a
    ))
    if (user && supabase) {
      supabase
        .from('alerts')
        .update({ triggered: true, triggered_at: new Date(triggeredAt).toISOString() })
        .eq('id', id)
        .then(logSync('trigger'))
    }
  }, [user])

  const resetAlert = useCallback((id) => {
    setAlerts(prev => prev.map(a =>
      a.id === id ? { ...a, triggered: false, triggeredAt: null } : a
    ))
    if (user && supabase) {
      supabase
        .from('alerts')
        .update({ triggered: false, triggered_at: null })
        .eq('id', id)
        .then(logSync('reset'))
    }
  }, [user])

  const clearTriggered = useCallback(() => {
    setAlerts(prev => prev.filter(a => !a.triggered))
    if (user && supabase) {
      supabase
        .from('alerts')
        .delete()
        .eq('user_id', user.id)
        .eq('triggered', true)
        .then(logSync('clear'))
    }
  }, [user])

  const activeCount = alerts.filter(a => !a.triggered).length

  return (
    <AlertsContext.Provider value={{
      alerts,
      addAlert,
      removeAlert,
      markTriggered,
      resetAlert,
      clearTriggered,
      activeCount,
      synced,
    }}>
      {children}
    </AlertsContext.Provider>
  )
}

export function useAlerts() {
  return useContext(AlertsContext)
}
