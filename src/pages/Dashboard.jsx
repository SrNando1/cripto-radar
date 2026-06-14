import { useState } from 'react'
import { useCoins } from '../hooks/useCoins'
import GlobalMetrics from '../components/GlobalMetrics'
import CoinTable from '../components/CoinTable'
import PriceChart from '../components/PriceChart'
import styles from './Dashboard.module.css'

export default function Dashboard() {
  const { coins, globalData, loading, error, lastUpdate, refresh } = useCoins()
  const [selectedCoin, setSelectedCoin] = useState(null)

  const activeCoin = selectedCoin || coins[0] || null

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.pageTitle}>
          <span className={styles.liveDot} />
          Mercado em Tempo Real
        </div>
        <div className={styles.meta}>
          {lastUpdate && (
            <span className={styles.updated}>
              Atualizado {lastUpdate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button className={styles.refreshBtn} onClick={refresh}>↻ Atualizar</button>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <GlobalMetrics data={globalData} />
      <PriceChart coin={activeCoin} />

      {loading ? (
        <div className={styles.loading}>A carregar criptomoedas...</div>
      ) : (
        <CoinTable
          coins={coins}
          onSelectCoin={setSelectedCoin}
          selectedCoinId={activeCoin?.id}
        />
      )}
    </div>
  )
}
