import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import styles from './AiAnalysisModal.module.css'

const HORIZONTES = [
  { key: 'curto', label: 'Curto prazo', hint: 'dias' },
  { key: 'medio', label: 'Médio prazo', hint: 'semanas' },
  { key: 'longo', label: 'Longo prazo', hint: 'meses' },
]

function Sinal({ valor }) {
  const v = (valor || '').toLowerCase()
  const cls = v.includes('compra') ? styles.compra : v.includes('venda') ? styles.venda : styles.neutro
  const txt = v.includes('compra') ? 'Compra' : v.includes('venda') ? 'Venda' : 'Neutro'
  return <span className={`${styles.badge} ${cls}`}>{txt}</span>
}

export default function AiAnalysisModal({ coin, onClose }) {
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState(null)
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
              change_24h: coin.price_change_percentage_24h,
              change_7d: coin.price_change_percentage_7d_in_currency,
              change_30d: coin.price_change_percentage_30d_in_currency,
              market_cap_rank: coin.market_cap_rank,
            },
          },
        })
        if (cancelled) return
        if (err) {
          let msg = err.message || 'erro desconhecido'
          try {
            const body = await err.context?.json?.()
            if (body?.error) msg = body.error + (body.detail ? ` · ${body.detail}` : '')
          } catch { /* mantém msg */ }
          throw new Error(msg)
        }
        setResult(data.analysis)
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
            <span>✨ Tendência IA · {coin.name}</span>
          </div>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>

        {loading && <div className={styles.loading}>A analisar com IA…</div>}
        {error && <div className={styles.error}>{error}</div>}

        {!loading && !error && result && (
          <>
            <div className={styles.rows}>
              {HORIZONTES.map(h => (
                <div key={h.key} className={styles.row}>
                  <div className={styles.rowLabel}>
                    {h.label}
                    <span className={styles.hint}>{h.hint}</span>
                  </div>
                  <Sinal valor={result.signals?.[h.key]} />
                </div>
              ))}
            </div>
            {result.resumo && <div className={styles.resumo}>{result.resumo}</div>}
          </>
        )}

        <div className={styles.disclaimer}>
          Tendência informativa gerada por IA — não é aconselhamento financeiro. Decide por tua conta.
        </div>
      </div>
    </div>
  )
}
