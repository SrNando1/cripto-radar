// Preços ao vivo da Binance — WebSocket público, grátis e sem chave de API.
// Stream `!miniTicker@arr`: array com o mini-ticker de TODOS os símbolos, ~1×/seg.
// Cada item tem { s: 'BTCUSDT', c: '63000.00', ... } (c = último preço de fecho).
const WS_URL = 'wss://stream.binance.com:9443/ws/!miniTicker@arr'

/**
 * Subscreve os preços ao vivo. `onPrices` recebe um mapa { 'BTCUSDT': 63000.12, ... }
 * a cada atualização (~1s). Devolve uma função para cancelar a subscrição.
 * Reconecta automaticamente com backoff simples (a Binance fecha a ligação a cada 24h).
 */
export function subscribeLivePrices(onPrices) {
  let ws
  let closed = false
  let retry = 0
  let timer

  function connect() {
    try {
      ws = new WebSocket(WS_URL)
    } catch {
      scheduleReconnect()
      return
    }

    ws.onopen = () => { retry = 0 }

    ws.onmessage = (ev) => {
      try {
        const arr = JSON.parse(ev.data)
        if (!Array.isArray(arr)) return
        const map = {}
        for (const t of arr) {
          if (typeof t.s === 'string' && t.s.endsWith('USDT')) {
            const p = parseFloat(t.c)
            if (p > 0) map[t.s] = p
          }
        }
        onPrices(map)
      } catch { /* payload inválido — ignora */ }
    }

    ws.onclose = () => { if (!closed) scheduleReconnect() }
    ws.onerror = () => { try { ws.close() } catch { /* já fechado */ } }
  }

  function scheduleReconnect() {
    retry = Math.min(retry + 1, 6)
    timer = setTimeout(connect, 1000 * retry) // 1s, 2s, … até 6s
  }

  connect()

  return () => {
    closed = true
    clearTimeout(timer)
    try { ws && ws.close() } catch { /* já fechado */ }
  }
}
