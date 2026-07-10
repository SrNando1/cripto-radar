import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './UpgradeModal.module.css'

/**
 * Modal mostrado quando um utilizador Free atinge um limite.
 * `title` e `message` descrevem a funcionalidade bloqueada.
 */
export default function UpgradeModal({ title, message, onClose }) {
  const navigate = useNavigate()

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.close} onClick={onClose}>✕</button>
        <div className={styles.icon}>🔒</div>
        <div className={styles.title}>{title}</div>
        <div className={styles.message}>{message}</div>
        <button
          className={styles.cta}
          onClick={() => { onClose(); navigate('/planos') }}
        >
          Ver planos Pro
        </button>
        <div className={styles.hint}>A partir de 4€/mês · cancela quando quiseres</div>
      </div>
    </div>
  )
}
