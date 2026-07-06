import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchCoins } from '../services/api'
import styles from './CoinSearch.module.css'

/**
 * Pesquisa de qualquer criptomoeda (exclusivo Trader).
 * canSearch=false → barra bloqueada que leva aos planos.
 * onPick(coinLite) → { id, name, symbol, thumb }
 */
export default function CoinSearch({ canSearch, onPick }) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    if (!canSearch || !q.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      try {
        const r = await searchCoins(q)
        setResults(r.slice(0, 8))
        setOpen(true)
      } catch { /* ignora */ }
    }, 300)
    return () => clearTimeout(t)
  }, [q, canSearch])

  useEffect(() => {
    const onClick = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [])

  if (!canSearch) {
    return (
      <div className={styles.locked} onClick={() => navigate('/planos')} title="Pesquisa exclusiva do plano Trader">
        🔍 Pesquisar qualquer criptomoeda… <span className={styles.badge}>🔒 Trader</span>
      </div>
    )
  }

  const pick = (c) => {
    onPick({ id: c.id, name: c.name, symbol: c.symbol, thumb: c.thumb || c.large })
    setQ(''); setResults([]); setOpen(false)
  }

  return (
    <div className={styles.wrap} ref={boxRef}>
      <input
        className={styles.input}
        placeholder="🔍 Pesquisar qualquer criptomoeda (17.000+)…"
        value={q}
        onChange={e => setQ(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
      />
      {open && results.length > 0 && (
        <div className={styles.dropdown}>
          {results.map(c => (
            <button key={c.id} className={styles.result} onClick={() => pick(c)}>
              {c.thumb && <img src={c.thumb} alt="" width={20} height={20} />}
              <span className={styles.rName}>{c.name}</span>
              <span className={styles.rSym}>{c.symbol}</span>
              {c.market_cap_rank && <span className={styles.rRank}>#{c.market_cap_rank}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
