import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useWatchlist } from '../context/WatchlistContext'
import { useAlerts } from '../context/AlertsContext'
import { usePlan } from '../context/PlanContext'
import { getLimits } from '../config/plans'
import PriceChart from '../components/PriceChart'
import AlertModal from '../components/AlertModal'
import { useCoins } from '../hooks/useCoins'
import styles from './Watchlist.module.css'

function fmtPrice(p) {
  if (!p) return '—'
  if (p >= 1000) return '$' + p.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (p >= 1) return '$' + p.toFixed(4)
  return '$' + p.toFixed(6)
}

export default function Watchlist() {
  const { watchlist, removeFromWatchlist } = useWatchlist()
  const { alerts } = useAlerts()
  const { plan } = usePlan()
  const { coins } = useCoins()

  // Nº de alertas ativos (por disparar) por moeda
  const activeAlertsByCoin = alerts.reduce((acc, a) => {
    if (!a.triggered) acc[a.coinId] = (acc[a.coinId] || 0) + 1
    return acc
  }, {})
  const [selected, setSelected] = useState(null)
  const [alertCoin, setAlertCoin] = useState(null)

  const { watchlistMax } = getLimits(plan)
  const showLimit = isFinite(watchlistMax)

  const enriched = watchlist.map(w => {
    const live = coins.find(c => c.id === w.id)
    return live || w
  })

  const activeCoin = selected || enriched[0] || null

  if (watchlist.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>★</div>
        <div className={styles.emptyTitle}>Watchlist vazia</div>
        <div className={styles.emptyText}>Vai ao Dashboard e clica na estrela ★ ao lado de uma cripto para a guardar aqui.</div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <div className={styles.title}>A Minha Watchlist</div>
        {showLimit && (
          <div className={styles.usage}>
            {watchlist.length}/{watchlistMax} criptos · plano Free
            {watchlist.length >= watchlistMax && (
              <Link to="/planos" className={styles.upgradeLink}>upgrade →</Link>
            )}
          </div>
        )}
      </div>
      <PriceChart coin={activeCoin} />
      <div className={styles.grid}>
        {enriched.map(coin => {
          const up = coin.price_change_percentage_24h >= 0
          const isSel = activeCoin?.id === coin.id
          const alertCount = activeAlertsByCoin[coin.id] || 0
          return (
            <div
              key={coin.id}
              className={`${styles.card} ${isSel ? styles.selected : ''}`}
              onClick={() => setSelected(coin)}
            >
              <div className={styles.cardTop}>
                <div className={styles.coinInfo}>
                  <img src={coin.image} alt={coin.name} width={32} height={32} style={{ borderRadius: '50%' }} />
                  <div>
                    <div className={styles.coinName}>{coin.name}</div>
                    <div className={styles.coinSymbol}>{coin.symbol?.toUpperCase()}</div>
                  </div>
                </div>
                <div className={styles.cardActions}>
                  <button
                    className={styles.bellBtn}
                    onClick={e => { e.stopPropagation(); setAlertCoin(coin) }}
                    title="Criar alerta de preço"
                  >🔔</button>
                  <button
                    className={styles.removeBtn}
                    onClick={e => { e.stopPropagation(); removeFromWatchlist(coin.id) }}
                    title="Remover da watchlist"
                  >✕</button>
                </div>
              </div>
              <div className={styles.cardPrice}>{fmtPrice(coin.current_price)}</div>
              <div className={`${styles.cardChange} ${up ? styles.green : styles.red}`}>
                {up ? '+' : ''}{coin.price_change_percentage_24h?.toFixed(2)}% 24h
              </div>
              {alertCount > 0 && (
                <Link
                  to="/alertas"
                  className={styles.alertCount}
                  onClick={e => e.stopPropagation()}
                  title="Ver alertas"
                >
                  🔔 {alertCount} alerta{alertCount > 1 ? 's' : ''} ativo{alertCount > 1 ? 's' : ''}
                </Link>
              )}
            </div>
          )
        })}
      </div>
      {alertCoin && <AlertModal coin={alertCoin} onClose={() => setAlertCoin(null)} />}
    </div>
  )
}
