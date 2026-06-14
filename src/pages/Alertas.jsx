import { useAlerts } from '../context/AlertsContext'
import { useCoins } from '../context/CoinsContext'
import styles from './Alertas.module.css'

function fmtPrice(p) {
  if (p == null) return '—'
  if (p >= 1000) return '$' + p.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (p >= 1) return '$' + p.toFixed(4)
  return '$' + p.toFixed(6)
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'agora mesmo'
  if (s < 3600) return `há ${Math.floor(s / 60)} min`
  if (s < 86400) return `há ${Math.floor(s / 3600)}h`
  return `há ${Math.floor(s / 86400)} dias`
}

export default function Alertas() {
  const { alerts, removeAlert, resetAlert, clearTriggered } = useAlerts()
  const { coins } = useCoins()
  const priceById = new Map(coins.map(c => [c.id, c.current_price]))

  const triggeredCount = alerts.filter(a => a.triggered).length

  if (alerts.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>🔔</div>
        <div className={styles.emptyTitle}>Sem alertas</div>
        <div className={styles.emptyText}>
          No Dashboard, clica no sino 🔔 ao lado de uma cripto para seres avisado quando o preço atingir o teu alvo.
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.title}>Os Meus Alertas</div>
        {triggeredCount > 0 && (
          <button className={styles.clearBtn} onClick={clearTriggered}>
            Limpar acionados ({triggeredCount})
          </button>
        )}
      </div>

      <div className={styles.list}>
        {alerts.map(a => {
          const livePrice = priceById.get(a.coinId)
          const isUp = a.direction === 'above'
          let progress = 0
          if (livePrice != null && a.priceAtCreation != null && a.priceAtCreation !== a.targetPrice) {
            progress = (livePrice - a.priceAtCreation) / (a.targetPrice - a.priceAtCreation)
            progress = Math.max(0, Math.min(1, progress)) * 100
          }
          return (
            <div key={a.id} className={`${styles.row} ${a.triggered ? styles.done : ''}`}>
              <img src={a.coinImage} alt={a.coinName} width={36} height={36} style={{ borderRadius: '50%' }} />

              <div className={styles.info}>
                <div className={styles.coinName}>
                  {a.coinName}
                  <span className={styles.symbol}>{a.symbol?.toUpperCase()}</span>
                </div>
                <div className={styles.condition}>
                  <span className={isUp ? styles.up : styles.down}>
                    {isUp ? '↑ acima de' : '↓ abaixo de'} {fmtPrice(a.targetPrice)}
                  </span>
                  {!a.triggered && livePrice != null && (
                    <span className={styles.live}> · atual {fmtPrice(livePrice)}</span>
                  )}
                </div>
                {a.note && <div className={styles.note}>{a.note}</div>}
                {a.notifyEmail && <div className={styles.emailTag}>📧 também por email</div>}
                {!a.triggered && (
                  <div className={styles.progressTrack}>
                    <div
                      className={`${styles.progressFill} ${isUp ? styles.fillUp : styles.fillDown}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
              </div>

              <div className={styles.right}>
                {a.triggered ? (
                  <>
                    <span className={styles.triggeredTag}>✓ acionado {timeAgo(a.triggeredAt)}</span>
                    <button className={styles.linkBtn} onClick={() => resetAlert(a.id)}>reativar</button>
                  </>
                ) : (
                  <span className={styles.activeTag}>ativo</span>
                )}
                <button
                  className={styles.removeBtn}
                  onClick={() => removeAlert(a.id)}
                  title="Eliminar alerta"
                >✕ eliminar</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
