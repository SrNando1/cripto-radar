import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabase'
import { useAuth } from './AuthContext'

const PlanContext = createContext()

export function PlanProvider({ children }) {
  const { user } = useAuth()
  const [plan, setPlan] = useState('free')

  const refreshPlan = useCallback(async () => {
    if (!user || !supabase) {
      setPlan('free')
      return
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('plan')
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) {
      console.warn('[plan] load:', error.message)
      return
    }
    setPlan(data?.plan || 'free')
  }, [user])

  useEffect(() => {
    refreshPlan()
  }, [refreshPlan])

  return (
    <PlanContext.Provider value={{
      plan,                     // 'free' | 'pro' | 'trader'
      isPaid: plan !== 'free',
      refreshPlan,
    }}>
      {children}
    </PlanContext.Provider>
  )
}

export function usePlan() {
  return useContext(PlanContext)
}
