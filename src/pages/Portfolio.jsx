import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { usePortfolio } from '../context/PortfolioContext'
import { usePlan } from '../context/PlanContext'
import { getLimits } from '../config/plans'
import { fetchCoins } from '../services/api'
import UpgradeModal from '../components/UpgradeModal'
import styles from './Portfolio.module.css'

function fmt(n) {
  if (n == null || isNaN(n)) return '—'
  return '$' + n.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtPct(n) {
  if (n == null || isNaN(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

export default function Portfolio() {
  const { holdings, addHolding, removeHolding } = usePortfolio()
  const { plan } = usePlan()
  const { portfolioMax } = getLimits(plan)

  const [market, setMarket] = useState([])
  const [coinId, setCoinId] = useState('')
  const [qty, setQty] = useState('')
  const [buy, setBuy] = useState('')
  const [showUpgrade, setShowUpgrade] = useState(false)

  // Top 100 para o seletor e para os preços atuais (uma chamada, com cache)
  useEffect(() => {
    fetchCoins(1, 100).then(setMarket).catch(() => {})
  }, [])

  const priceById = useMemo(() => new Map(market.map(c => [c.id, c])), [market])

  const rows = holdings.map(h => {
    const live = priceById.get(h.id)
    const price = live?.current_price
    const value = price != null ? h.quantity * price : null
    const cost = h.quantity * h.buyPrice
    const pnl = value != null ? value - cost : null
    const pnlPct = value != null && cost > 0 ? (pnl / cost) * 100 : null
    return { ...h, image: live?.image || h.image, price, value, cost, pnl, pnlPct }
  })

  const totalValue = rows.reduce((s, r) => s + (r.value || 0), 0)
  const totalCost = rows.reduce((s, r) => s + r.cost, 0)
  const totalPnl = totalValue - totalCost
  const totalPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0

  const onPickCoin = (id) => {
    setCoinId(id)
    const existing = holdings.find(h => h.id === id)
    if (existing) {
      // Já tens esta moeda → pré-preenche para editares a posição
      setQty(String(existing.quantity))
      setBuy(String(existing.buyPrice))
    } else {
      const c = priceById.get(id)
      setBuy(c ? String(c.current_price) : '') // sugere o preço atual como preço de compra
    }
  }

  const onAdd = (e) => {
    e.preventDefault()
    const c = priceById.get(coinId)
    const q = parseFloat(qty)
    const b = parseFloat(buy)
    if (!c || isNaN(q) || q <= 0 || isNaN(b) || b <= 0) return
    const jaExiste = holdings.some(h => h.id === coinId)
    if (!jaExiste && holdings.length >= portfolioMax) {
      setShowUpgrade(true)
      return
    }
    addHolding(c, q, b)
    setCoinId(''); setQty(''); setBuy('')
  }

  const atalho = isFinite(portfolioMax)

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.title}>O Meu Portfolio</div>
        {atalho && (
          <div className={styles.usage}>
            {holdings.length}/{portfolioMax} · plano Free
            {holdings.length >= portfolioMax && <Link to="/planos" className={styles.upgradeLink}>upgrade →</Link>}
          </div>
        )}
      </div>

      {/* Resumo */}
      <div className={styles.summary}>
        <div className={styles.sumCard}>
          <div className={styles.sumLabel}>Valor atual</div>
          <div className={styles.sumValue}>{fmt(totalValue)}</div>
        </div>
        <div className={styles.sumCard}>
          <div className={styles.sumLabel}>Investido</div>
          <div className={styles.sumValue}>{fmt(totalCost)}</div>
        </div>
        <div className={styles.sumCard}>
          <div className={styles.sumLabel}>Lucro / Prejuízo</div>
          <div className={`${styles.sumValue} ${totalPnl >= 0 ? styles.green : styles.red}`}>
            {fmt(totalPnl)} <span className={styles.sumPct}>{fmtPct(totalPct)}</span>
          </div>
        </div>
      </div>

      {/* Adicionar posição */}
      <form className={styles.addForm} onSubmit={onAdd}>
        <select className={styles.select} value={coinId} onChange={e => onPickCoin(e.target.value)}>
          <option value="">Escolher cripto…</option>
          {market.map(c => (
            <option key={c.id} value={c.id}>{c.name} ({c.symbol.toUpperCase()})</option>
          ))}
        </select>
        <input className={styles.input} type="number" step="any" placeholder="Quantidade" value={qty} onChange={e => setQty(e.target.value)} />
        <input className={styles.input} type="number" step="any" placeholder="Preço médio ($)" value={buy} onChange={e => setBuy(e.target.value)} />
        <button className={styles.addBtn} type="submit">
          {coinId && holdings.some(h => h.id === coinId) ? 'Atualizar' : 'Adicionar'}
        </button>
      </form>

      {/* Lista */}
      {rows.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>💼</div>
          <div className={styles.emptyText}>Adiciona as tuas posições acima para veres o lucro/prejuízo ao vivo.</div>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Cripto</th>
                <th style={{ textAlign: 'right' }}>Qtd.</th>
                <th style={{ textAlign: 'right' }}>Preço médio</th>
                <th style={{ textAlign: 'right' }}>Preço atual</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
                <th style={{ textAlign: 'right' }}>L/P</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td>
                    <div className={styles.coin}>
                      {r.image && <img src={r.image} alt={r.name} width={22} height={22} />}
                      <div>
                        <div className={styles.coinName}>{r.name}</div>
                        <div className={styles.coinSym}>{r.symbol?.toUpperCase()}</div>
                      </div>
                    </div>
                  </td>
                  <td className={styles.num}>{r.quantity}</td>
                  <td className={styles.num}>{fmt(r.buyPrice)}</td>
                  <td className={styles.num}>{fmt(r.price)}</td>
                  <td className={styles.num}>{fmt(r.value)}</td>
                  <td className={`${styles.num} ${r.pnl >= 0 ? styles.green : styles.red}`}>
                    {fmt(r.pnl)}<div className={styles.pnlPct}>{fmtPct(r.pnlPct)}</div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className={styles.removeBtn} onClick={() => removeHolding(r.id)} title="Eliminar posição">✕ eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showUpgrade && (
        <UpgradeModal
          title={`Portfolio limitado a ${portfolioMax} no plano Free`}
          message="Faz upgrade para Pro e acompanha um portfolio ilimitado com lucro/prejuízo ao vivo."
          onClose={() => setShowUpgrade(false)}
        />
      )}
    </div>
  )
}
