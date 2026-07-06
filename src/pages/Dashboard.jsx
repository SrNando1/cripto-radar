import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useCoins } from '../hooks/useCoins'
import { usePlan } from '../context/PlanContext'
import { getLimits } from '../config/plans'
import { fetchCoinsByIds } from '../services/api'
import GlobalMetrics from '../components/GlobalMetrics'
import CoinTable from '../components/CoinTable'
import PriceChart from '../components/PriceChart'
import CoinSearch from '../components/CoinSearch'
import styles from './Dashboard.module.css'

export default function Dashboard() {
  const { coins, globalData, loading, error, lastUpdate, refresh, refreshMs } = useCoins()
  const { plan } = usePlan()
  const canSearch = getLimits(plan).search
  const [selectedCoin, setSelectedCoin] = useState(null)
  const [now, setNow] = useState(Date.now())

  const onPickSearch = async (lite) => {
    try {
      const res = await fetchCoinsByIds([lite.id])
      if (res && res[0]) { setSelectedCoin(res[0]); return }
    } catch { /* fallback abaixo */ }
    setSelectedCoin({ id: lite.id, name: lite.name, symbol: lite.symbol, image: lite.thumb })
  }

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const secsLeft = lastUpdate
    ? Math.max(0, Math.ceil((refreshMs - (now - lastUpdate.getTime())) / 1000))
    : null
  const isFreeRefresh = refreshMs >= 60000

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
              {secsLeft != null && <> · próxima em {secsLeft}s</>}
            </span>
          )}
          {isFreeRefresh && (
            <Link to="/planos" className={styles.proHint} title="Atualização a cada 10s no plano Pro">⚡ 10s no Pro</Link>
          )}
          <button className={styles.refreshBtn} onClick={refresh}>↻ Atualizar</button>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <CoinSearch canSearch={canSearch} onPick={onPickSearch} />

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

      {isFreeRefresh && !loading && (
        <Link to="/planos" className={styles.moreCoins}>
          🔒 O plano Free mostra o Top 20 — vê as 250 principais criptomoedas no Pro →
        </Link>
      )}
    </div>
  )
}
