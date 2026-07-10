import { useState } from 'react'
import { useWatchlist } from '../context/WatchlistContext'
import { usePlan } from '../context/PlanContext'
import { getLimits } from '../config/plans'
import AlertModal from './AlertModal'
import UpgradeModal from './UpgradeModal'
import styles from './CoinTable.module.css'

function fmt(n) {
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T'
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M'
  return '$' + n.toLocaleString('pt-PT', { minimumFractionDigits: 2 })
}

function fmtPrice(p) {
  if (p >= 1000) return '$' + p.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (p >= 1) return '$' + p.toFixed(4)
  return '$' + p.toFixed(6)
}

export default function CoinTable({ coins, onSelectCoin, selectedCoinId }) {
  const { watchlist, isInWatchlist, addToWatchlist, removeFromWatchlist } = useWatchlist()
  const { plan } = usePlan()
  const [alertCoin, setAlertCoin] = useState(null)
  const [showUpgrade, setShowUpgrade] = useState(false)

  const { watchlistMax } = getLimits(plan)

  const toggleWatchlist = (e, coin) => {
    e.stopPropagation()
    if (isInWatchlist(coin.id)) {
      removeFromWatchlist(coin.id)
    } else {
      if (watchlist.length >= watchlistMax) {
        setShowUpgrade(true)
        return
      }
      addToWatchlist(coin)
    }
  }

  const openAlert = (e, coin) => {
    e.stopPropagation()
    setAlertCoin(coin)
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>#</th>
            <th>Nome</th>
            <th style={{ textAlign: 'right' }}>Preço</th>
            <th style={{ textAlign: 'right' }}>24h</th>
            <th style={{ textAlign: 'right' }} title="Variação desde a última atualização">Δ att.</th>
            <th style={{ textAlign: 'right' }}>Cap. Mercado</th>
            <th style={{ textAlign: 'center' }}>🔔</th>
            <th style={{ textAlign: 'center' }}>★</th>
          </tr>
        </thead>
        <tbody>
          {coins.map(coin => {
            const up = coin.price_change_percentage_24h >= 0
            const selected = selectedCoinId === coin.id
            const inWl = isInWatchlist(coin.id)
            return (
              <tr
                key={coin.id}
                onClick={() => onSelectCoin(coin)}
                className={selected ? styles.selected : ''}
              >
                <td className={styles.rank}>{coin.market_cap_rank}</td>
                <td>
                  <div className={styles.coinInfo}>
                    <img src={coin.image} alt={coin.name} width={24} height={24} />
                    <div>
                      <div className={styles.coinName}>{coin.name}</div>
                      <div className={styles.coinSymbol}>{coin.symbol.toUpperCase()}</div>
                    </div>
                  </div>
                </td>
                <td className={styles.price}>{fmtPrice(coin.current_price)}</td>
                <td style={{ textAlign: 'right' }}>
                  <span className={`${styles.badge} ${up ? styles.up : styles.down}`}>
                    {up ? '+' : ''}{coin.price_change_percentage_24h?.toFixed(2)}%
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  {coin.tickChange == null ? (
                    <span className={styles.tickFlat}>—</span>
                  ) : (
                    <span
                      key={coin.current_price}
                      className={`${styles.tick} ${styles.tickAnim} ${coin.tickChange > 0 ? styles.tickUp : coin.tickChange < 0 ? styles.tickDown : styles.tickFlat}`}
                    >
                      {coin.tickChange > 0 ? '▲ +' : coin.tickChange < 0 ? '▼ ' : ''}
                      {coin.tickChange.toFixed(2)}%
                    </span>
                  )}
                </td>
                <td className={styles.mcap}>{fmt(coin.market_cap)}</td>
                <td style={{ textAlign: 'center' }}>
                  <button
                    className={styles.bell}
                    onClick={e => openAlert(e, coin)}
                    title="Criar alerta de preço"
                  >🔔</button>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <button
                    className={`${styles.star} ${inWl ? styles.starActive : ''}`}
                    onClick={e => toggleWatchlist(e, coin)}
                  >★</button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {alertCoin && <AlertModal coin={alertCoin} onClose={() => setAlertCoin(null)} />}
      {showUpgrade && (
        <UpgradeModal
          title={`Watchlist limitada a ${watchlistMax} no plano Free`}
          message="Faz upgrade para Pro e segue todas as criptomoedas que quiseres, sem limites."
          onClose={() => setShowUpgrade(false)}
        />
      )}
    </div>
  )
}
