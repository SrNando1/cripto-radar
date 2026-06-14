import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAlerts } from '../context/AlertsContext'
import { usePlan } from '../context/PlanContext'
import styles from './AlertModal.module.css'

function fmtPrice(p) {
  if (p == null || isNaN(p)) return '—'
  if (p >= 1000) return '$' + p.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (p >= 1) return '$' + p.toFixed(4)
  return '$' + p.toFixed(6)
}

// Aceita formato PT ("62.100,50" / "62 100,50") e EN ("62,100.50" / "62100.5").
// Regra: o separador mais à direita (',' ou '.') é o decimal; os restantes são milhares.
function parsePrice(raw) {
  if (raw == null) return NaN
  const s = String(raw).replace(/[^\d.,]/g, '')
  if (!s) return NaN
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  let normalized
  if (lastComma > -1 && lastDot > -1) {
    normalized = lastComma > lastDot
      ? s.replace(/\./g, '').replace(',', '.')   // PT: ponto = milhares, vírgula = decimal
      : s.replace(/,/g, '')                       // EN: vírgula = milhares, ponto = decimal
  } else if (lastComma > -1) {
    normalized = s.replace(',', '.')              // só vírgula → decimal
  } else {
    normalized = s                                // só ponto (ou nada) → já em formato JS
  }
  return parseFloat(normalized)
}

const PRESETS = [
  { label: '+5%', factor: 1.05, dir: 'above' },
  { label: '+10%', factor: 1.1, dir: 'above' },
  { label: '-5%', factor: 0.95, dir: 'below' },
  { label: '-10%', factor: 0.9, dir: 'below' },
]

export default function AlertModal({ coin, onClose }) {
  const { addAlert } = useAlerts()
  const { isPaid } = usePlan()
  const navigate = useNavigate()
  const current = coin?.current_price ?? 0
  const [direction, setDirection] = useState('above')
  const [value, setValue] = useState(String(current))
  const [note, setNote] = useState('')
  const [notifyEmail, setNotifyEmail] = useState(false)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!coin) return null

  const target = parsePrice(value)
  const valid = !isNaN(target) && target > 0
  const pct = valid && current > 0 ? ((target - current) / current) * 100 : 0

  // O alerta dispararia já agora? (causa típica de erro: separador decimal/milhares trocado)
  const firesImmediately = valid && (
    (direction === 'above' && target <= current) ||
    (direction === 'below' && target >= current)
  )

  const applyPreset = (p) => {
    setDirection(p.dir)
    const t = current * p.factor
    setValue(t >= 1 ? t.toFixed(2) : t.toPrecision(4))
  }

  const submit = async () => {
    if (!valid || firesImmediately) return
    if ('Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission() } catch { /* ignorado */ }
    }
    addAlert({
      coinId: coin.id,
      coinName: coin.name,
      coinImage: coin.image,
      symbol: coin.symbol,
      direction,
      targetPrice: target,
      priceAtCreation: current,
      note,
      notifyEmail: isPaid && notifyEmail,
    })
    onClose()
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.coin}>
            <img src={coin.image} alt={coin.name} width={28} height={28} style={{ borderRadius: '50%' }} />
            <div>
              <div className={styles.coinName}>{coin.name}</div>
              <div className={styles.coinNow}>Agora: {fmtPrice(current)}</div>
            </div>
          </div>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>

        <div className={styles.label}>Avisa-me quando o preço:</div>
        <div className={styles.toggle}>
          <button
            className={`${styles.toggleBtn} ${direction === 'above' ? styles.toggleActiveUp : ''}`}
            onClick={() => setDirection('above')}
          >↑ Subir acima de</button>
          <button
            className={`${styles.toggleBtn} ${direction === 'below' ? styles.toggleActiveDown : ''}`}
            onClick={() => setDirection('below')}
          >↓ Descer abaixo de</button>
        </div>

        <div className={`${styles.inputWrap} ${firesImmediately ? styles.inputWarn : ''}`}>
          <span className={styles.dollar}>$</span>
          <input
            className={styles.input}
            type="text"
            inputMode="decimal"
            value={value}
            onChange={e => setValue(e.target.value)}
            autoFocus
          />
          {valid && current > 0 && (
            <span className={`${styles.pct} ${pct >= 0 ? styles.up : styles.down}`}>
              {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
            </span>
          )}
        </div>

        <div className={styles.presets}>
          {PRESETS.map(p => (
            <button key={p.label} className={styles.preset} onClick={() => applyPreset(p)}>{p.label}</button>
          ))}
        </div>

        <input
          className={styles.noteInput}
          type="text"
          maxLength={80}
          placeholder="Descrição (opcional) — ex.: zona de compra"
          value={note}
          onChange={e => setNote(e.target.value)}
        />

        {isPaid ? (
          <label className={styles.emailRow}>
            <input
              type="checkbox"
              checked={notifyEmail}
              onChange={e => setNotifyEmail(e.target.checked)}
            />
            <span>📧 Avisar também por email (funciona com a app fechada)</span>
          </label>
        ) : (
          <button
            type="button"
            className={styles.emailLocked}
            onClick={() => { onClose(); navigate('/planos') }}
          >
            🔒 Avisar por email — disponível no Pro
          </button>
        )}

        {firesImmediately && (
          <div className={styles.warn}>
            ⚠️ O preço atual ({fmtPrice(current)}) já está {direction === 'above' ? 'acima' : 'abaixo'} de {fmtPrice(target)},
            por isso o alerta dispararia logo. Confirma o valor — usa <b>.</b> para casas decimais (ex.: <code>62100</code>, não <code>62.100</code>).
          </div>
        )}

        <button className={styles.submit} onClick={submit} disabled={!valid || firesImmediately}>
          {firesImmediately ? 'Ajusta o valor do alvo' : valid ? `Criar alerta · ${fmtPrice(target)}` : 'Criar alerta'}
        </button>
        <div className={styles.hint}>
          {isPaid && notifyEmail
            ? 'Recebe notificação no browser e por email quando o alvo for atingido.'
            : 'Recebe uma notificação no browser quando o alvo for atingido.'}
        </div>
      </div>
    </div>
  )
}
