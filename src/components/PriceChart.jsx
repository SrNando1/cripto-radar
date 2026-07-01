import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'
import { fetchCoinChart } from '../services/api'
import { usePlan } from '../context/PlanContext'
import { getLimits } from '../config/plans'
import UpgradeModal from './UpgradeModal'
import AiAnalysisModal from './AiAnalysisModal'
import styles from './PriceChart.module.css'

const RANGES = [
  { label: '1D', days: 1 },
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
]

function fmtPrice(p) {
  if (p >= 1000) return '$' + p.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (p >= 1) return '$' + p.toFixed(4)
  return '$' + p.toFixed(6)
}

export default function PriceChart({ coin }) {
  const { plan, isPaid } = usePlan()
  const { chartMaxDays } = getLimits(plan)
  const [days, setDays] = useState(7)
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [upgrade, setUpgrade] = useState(null) // null | { title, message }
  const [showAi, setShowAi] = useState(false)

  const onAnalyse = () => {
    if (isPaid) setShowAi(true)
    else setUpgrade({
      title: 'Análise com IA é Pro',
      message: 'Faz upgrade para Pro e recebe análises da IA para qualquer criptomoeda.',
    })
  }

  const selectRange = (r) => {
    if (r.days > chartMaxDays) {
      setUpgrade({
        title: 'Histórico estendido é Pro',
        message: 'O plano Free mostra até 7 dias. Faz upgrade para Pro e analisa 30, 90 dias ou mais.',
      })
      return
    }
    setDays(r.days)
  }

  useEffect(() => {
    if (!coin) return
    setLoading(true)
    fetchCoinChart(coin.id, days)
      .then(res => {
        const step = Math.max(1, Math.floor(res.prices.length / 80))
        const points = res.prices
          .filter((_, i) => i % step === 0)
          .map(([ts, price]) => {
            const date = new Date(ts)
            const label = days <= 1
              ? date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
              : date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })
            return { label, price }
          })
        setData(points)
      })
      .finally(() => setLoading(false))
  }, [coin, days])

  if (!coin) return null

  const isUp = data.length > 1 && data[data.length - 1]?.price >= data[0]?.price
  const color = isUp ? '#1D9E75' : '#E24B4A'
  const fillColor = isUp ? 'rgba(29,158,117,0.15)' : 'rgba(226,75,74,0.15)'

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <div className={styles.coinName}>
            <img src={coin.image} alt={coin.name} width={20} height={20} style={{ borderRadius: '50%' }} />
            {coin.name} <span className={styles.symbol}>{coin.symbol.toUpperCase()}</span>
          </div>
          <div className={styles.price} style={{ color }}>
            {fmtPrice(coin.current_price)}
            <span className={styles.change}>
              {isUp ? '+' : ''}{coin.price_change_percentage_24h?.toFixed(2)}% 24h
            </span>
          </div>
          <button className={styles.aiBtn} onClick={onAnalyse}>
            ✨ Tendência IA{!isPaid && ' 🔒'}
          </button>
        </div>
        <div className={styles.rangeTabs}>
          {RANGES.map(r => {
            const locked = r.days > chartMaxDays
            return (
              <button
                key={r.days}
                className={`${styles.rangeTab} ${days === r.days ? styles.active : ''} ${locked ? styles.locked : ''}`}
                onClick={() => selectRange(r)}
                title={locked ? 'Disponível no plano Pro' : undefined}
              >{r.label}{locked && ' 🔒'}</button>
            )
          })}
        </div>
      </div>
      {loading ? (
        <div className={styles.loading}>A carregar gráfico...</div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
            <defs>
              <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={{ fill: '#444', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fill: '#444', fontSize: 10 }} tickLine={false} axisLine={false} orientation="right" tickFormatter={v => fmtPrice(v)} width={80} />
            <Tooltip
              contentStyle={{ background: '#111', border: '0.5px solid #333', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#666' }}
              itemStyle={{ color: color }}
              formatter={v => [fmtPrice(v), 'Preço']}
            />
            <Area type="monotone" dataKey="price" stroke={color} strokeWidth={1.5} fill="url(#colorPrice)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
      {upgrade && (
        <UpgradeModal
          title={upgrade.title}
          message={upgrade.message}
          onClose={() => setUpgrade(null)}
        />
      )}
      {showAi && <AiAnalysisModal coin={coin} onClose={() => setShowAi(false)} />}
    </div>
  )
}
