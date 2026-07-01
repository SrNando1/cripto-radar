import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import styles from './AiAnalysisModal.module.css'

export default function AiAnalysisModal({ coin, onClose }) {
  const [loading, setLoading] = useState(true)
  const [analysis, setAnalysis] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const { data, error: err } = await supabase.functions.invoke('ai-analysis', {
          body: {
            coin: {
              id: coin.id,
              name: coin.name,
              symbol: coin.symbol,
              current_price: coin.current_price,
              price_change_percentage_24h: coin.price_change_percentage_24h,
              market_cap: coin.market_cap,
              market_cap_rank: coin.market_cap_rank,
            },
          },
        })
        if (cancelled) return
        if (err) {
          // Extrai a mensagem real devolvida pela função (para diagnóstico/UX)
          let msg = err.message || 'erro desconhecido'
          try {
            const body = await err.context?.json?.()
            if (body?.error) msg = body.error + (body.detail ? ` · ${body.detail}` : '')
          } catch { /* mantém msg */ }
          throw new Error(msg)
        }
        setAnalysis(data.analysis)
      } catch (e) {
        if (!cancelled) setError(e.message || 'Não foi possível gerar a análise. Tenta novamente daqui a pouco.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [coin])

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.title}>
            <img src={coin.image} alt={coin.name} width={24} height={24} style={{ borderRadius: '50%' }} />
            <span>✨ Análise IA · {coin.name}</span>
          </div>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>

        {loading && <div className={styles.loading}>A analisar com IA…</div>}
        {error && <div className={styles.error}>{error}</div>}
        {!loading && !error && <div className={styles.body}>{analysis}</div>}

        <div className={styles.disclaimer}>
          Análise informativa gerada por IA — não é aconselhamento financeiro.
        </div>
      </div>
    </div>
  )
}
