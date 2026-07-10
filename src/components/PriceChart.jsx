import { useState, useEffect, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'
import { fetchCoinChart } from '../services/api'
import { fetchKlines } from '../services/binanceStream'
import { usePlan } from '../context/PlanContext'
import { getLimits } from '../config/plans'
import UpgradeModal from './UpgradeModal'
import AiAnalysisModal from './AiAnalysisModal'
import styles from './PriceChart.module.css'

// Intervalos intraday (Binance klines, resolução ao seg/min) + históricos (CoinGecko).
const RANGES = [
  { label: '30s', binance: true, interval: '1s', limit: 30, live: true },
  { label: '1m', binance: true, interval: '1s', limit: 60, live: true },
  { label: '30m', binance: true, interval: '1m', limit: 30, live: true },
  { label: '1D', days: 1 },
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
]
const DEFAULT_RANGE = RANGES.find(r => r.days === 7)

function fmtPrice(p) {
  if (p >= 1000) return '$' + p.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (p >= 1) return '$' + p.toFixed(4)
  return '$' + p.toFixed(6)
}

export default function PriceChart({ coin }) {
  const { plan, isPaid } = usePlan()
  const { chartMaxDays } = getLimits(plan)
  const [range, setRange] = useState(DEFAULT_RANGE)
  const [history, setHistory] = useState([]) // pontos da fonte (CoinGecko ou Binance), não muda a cada tick
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
    if (r.binance && !isPaid) {
      setUpgrade({
        title: 'Gráficos intraday são Pro',
        message: 'Vê o movimento ao segundo e ao minuto (via Binance). Faz upgrade para Pro ou Trader.',
      })
      return
    }
    if (r.days > chartMaxDays) {
      setUpgrade({
        title: 'Histórico estendido é Pro',
        message: 'O plano Free mostra até 7 dias. Faz upgrade para Pro e analisa 30, 90 dias ou mais.',
      })
      return
    }
    setRange(r)
  }

  // Refaz os pontos só quando muda a moeda ou o intervalo — não a cada tick de preço.
  const coinId = coin?.id
  const binanceSymbol = coin?.symbol ? coin.symbol.toUpperCase() + 'USDT' : null
  useEffect(() => {
    if (!coinId) return
    let cancelled = false

    async function fetchData(showLoad) {
      if (showLoad) setLoading(true)
      try {
        let points
        if (range.binance) {
          if (!binanceSymbol) { if (!cancelled) setHistory([]); return }
          const kl = await fetchKlines(binanceSymbol, range.interval, range.limit)
          points = kl.map(({ ts, price }) => {
            const d = new Date(ts)
            const label = range.interval === '1s'
              ? d.toLocaleTimeString('pt-PT', { minute: '2-digit', second: '2-digit' })
              : d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
            return { label, price }
          })
        } else {
          const res = await fetchCoinChart(coinId, range.days)
          const step = Math.max(1, Math.floor(res.prices.length / 80))
          points = res.prices
            .filter((_, i) => i % step === 0)
            .map(([ts, price]) => {
              const date = new Date(ts)
              const label = range.days <= 1
                ? date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
                : date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })
              return { label, price }
            })
        }
        if (!cancelled) setHistory(points)
      } catch {
        if (!cancelled && showLoad) setHistory([])
      } finally {
        if (showLoad && !cancelled) setLoading(false)
      }
    }

    fetchData(true)
    // Intervalos intraday: refresca a janela sem piscar (1s → 2s, 30m → 20s).
    let timer
    if (range.binance) timer = setInterval(() => fetchData(false), range.interval === '1s' ? 2000 : 20000)
    return () => { cancelled = true; if (timer) clearInterval(timer) }
  }, [coinId, binanceSymbol, range])

  // O gráfico acompanha o preço ao vivo: acrescenta um ponto "agora" no fim da linha.
  const data = useMemo(() => {
    const live = coin?.current_price
    if (!history.length || live == null) return history
    return [...history, { label: 'agora', price: live }]
  }, [history, coin?.current_price])

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
            const locked = r.binance ? !isPaid : r.days > chartMaxDays
            return (
              <button
                key={r.label}
                className={`${styles.rangeTab} ${range.label === r.label ? styles.active : ''} ${locked ? styles.locked : ''}`}
                onClick={() => selectRange(r)}
                title={locked ? 'Disponível no plano Pro' : undefined}
              >{r.label}{locked && ' 🔒'}</button>
            )
          })}
        </div>
      </div>
      {loading ? (
        <div className={styles.loading}>A carregar gráfico...</div>
      ) : range.binance && !data.length ? (
        <div className={styles.loading}>Sem dados intraday para esta moeda na Binance.</div>
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
            <Area type="monotone" dataKey="price" stroke={color} strokeWidth={1.5} fill="url(#colorPrice)" dot={false} isAnimationActive={false} />
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
