import styles from './GlobalMetrics.module.css'

function fmt(n) {
  if (!n) return '—'
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T'
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'
  return '$' + n.toLocaleString('pt-PT')
}

export default function GlobalMetrics({ data }) {
  if (!data) return (
    <div className={styles.grid}>
      {[1,2,3].map(i => <div key={i} className={styles.card}><div className={styles.skeleton} /></div>)}
    </div>
  )

  const capChange = data.market_cap_change_percentage_24h_usd
  const isUp = capChange >= 0

  return (
    <div className={styles.grid}>
      <div className={styles.card}>
        <div className={styles.label}>Cap. Total Mercado</div>
        <div className={styles.value}>{fmt(data.total_market_cap?.usd)}</div>
        <div className={`${styles.sub} ${isUp ? styles.green : styles.red}`}>
          {isUp ? '+' : ''}{capChange?.toFixed(2)}% nas últimas 24h
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles.label}>Volume 24h</div>
        <div className={styles.value}>{fmt(data.total_volume?.usd)}</div>
        <div className={styles.sub} style={{ color: '#444' }}>Negociação global</div>
      </div>
      <div className={styles.card}>
        <div className={styles.label}>Dominância BTC</div>
        <div className={styles.value}>{data.market_cap_percentage?.btc?.toFixed(1)}%</div>
        <div className={styles.sub} style={{ color: '#444' }}>ETH: {data.market_cap_percentage?.eth?.toFixed(1)}%</div>
      </div>
    </div>
  )
}
