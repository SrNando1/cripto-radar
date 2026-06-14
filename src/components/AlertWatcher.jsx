import { useEffect, useRef } from 'react'
import { useCoins } from '../context/CoinsContext'
import { useAlerts } from '../context/AlertsContext'

function fmtPrice(p) {
  if (p == null) return '—'
  if (p >= 1000) return '$' + p.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (p >= 1) return '$' + p.toFixed(4)
  return '$' + p.toFixed(6)
}

function notify(alert, price) {
  const dir = alert.direction === 'above' ? 'subiu acima de' : 'desceu abaixo de'
  const title = `🔔 ${alert.coinName} ${dir} ${fmtPrice(alert.targetPrice)}`
  const body = alert.note
    ? `Preço atual: ${fmtPrice(price)} · ${alert.note}`
    : `Preço atual: ${fmtPrice(price)}`

  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, { body, icon: alert.coinImage, tag: alert.id })
    } catch {
      // Alguns browsers exigem service worker para notificações; ignoramos silenciosamente.
    }
  }
}

/**
 * Componente invisível: corre em toda a app e, a cada atualização de preços,
 * verifica se algum alerta ativo foi atingido. Dispara notificação do browser
 * e marca o alerta como acionado (deixa de re-disparar).
 */
export default function AlertWatcher() {
  const { coins } = useCoins()
  const { alerts, markTriggered } = useAlerts()
  const firedRef = useRef(new Set())
  const seeded = useRef(false)

  // Ao montar, semeia o dedup com os alertas já acionados (persistidos em
  // localStorage). Garante disparo único mesmo após remontagens (HMR, navegação).
  if (!seeded.current) {
    for (const a of alerts) if (a.triggered) firedRef.current.add(a.id)
    seeded.current = true
  }

  useEffect(() => {
    if (!coins.length || !alerts.length) return

    const priceById = new Map(coins.map(c => [c.id, c.current_price]))

    for (const alert of alerts) {
      if (alert.triggered || firedRef.current.has(alert.id)) continue

      const price = priceById.get(alert.coinId)
      if (price == null) continue

      const hit =
        alert.direction === 'above'
          ? price >= alert.targetPrice
          : price <= alert.targetPrice

      if (hit) {
        firedRef.current.add(alert.id)
        notify(alert, price)
        markTriggered(alert.id)
      }
    }
  }, [coins, alerts, markTriggered])

  return null
}
