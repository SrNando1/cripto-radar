import { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usePortfolio } from '../context/PortfolioContext'
import { usePlan } from '../context/PlanContext'
import { getLimits } from '../config/plans'
import { fetchCoins, searchCoins } from '../services/api'
import UpgradeModal from '../components/UpgradeModal'
import styles from './Portfolio.module.css'

function fmt(n) {
  if (n == null || isNaN(n)) return '—'
  return '$' + n.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtPct(n) {
  if (n == null || isNaN(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

const num = (s) => parseFloat(String(s || '').replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'))
const QUOTES = ['USDT', 'FDUSD', 'USDC', 'BUSD', 'TUSD', 'DAI', 'EUR', 'TRY', 'GBP', 'BRL', 'BTC', 'ETH', 'BNB']

function splitLine(l) {
  return l.split(/[,;\t]/).map(c => c.trim().replace(/^["']|["']$/g, ''))
}

// Parser CSV: reconhece o formato da Binance (Trade History) e o modelo simples.
// Devolve linhas { symbol, quantity, buyPrice } — só compras.
function parseCSV(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (!lines.length) return []
  const header = lines[0].toLowerCase()
  const cols = splitLine(header)
  const col = (...names) => cols.findIndex(c => names.some(n => c === n || c.includes(n)))

  // --- Formato Binance (Trade History): Date, Pair, Side, Price, Executed, Amount, Fee ---
  if (header.includes('pair') && header.includes('side')) {
    const iPair = col('pair'), iSide = col('side'), iPrice = col('price'), iExec = col('executed')
    const rows = []
    for (let i = 1; i < lines.length; i++) {
      const c = splitLine(lines[i])
      const side = (c[iSide] || '').toLowerCase()
      if (!side.includes('buy') && !side.includes('compra')) continue // só compras

      // símbolo + quantidade a partir de "Executed" (ex.: "0.01000000BTC")
      let symbol = '', quantity = NaN
      const m = (c[iExec] || '').match(/^([\d.,]+)\s*([A-Za-z]+)?$/)
      if (m) { quantity = num(m[1]); if (m[2]) symbol = m[2].toUpperCase() }
      if (!symbol && c[iPair]) {
        const pair = c[iPair].toUpperCase()
        const q = QUOTES.find(x => pair.endsWith(x) && pair.length > x.length)
        symbol = q ? pair.slice(0, -q.length) : pair
      }
      const buyPrice = num(c[iPrice])
      if (symbol) rows.push({ symbol, quantity, buyPrice })
    }
    return rows
  }

  // --- Modelo simples: símbolo, quantidade, preço ---
  let idx = { sym: 0, qty: 1, price: 2 }
  let start = 0
  if (/(symbol|s[íi]mbolo|simbolo|moeda|coin|ativo|asset)/.test(header)) {
    idx = {
      sym: Math.max(0, col('symbol', 'símbolo', 'simbolo', 'moeda', 'coin', 'ativo', 'asset')),
      qty: Math.max(1, col('quantidade', 'qtd', 'qty', 'quantity', 'amount', 'unidades')),
      price: Math.max(2, col('preço', 'preco', 'price', 'buy', 'custo', 'valor')),
    }
    start = 1
  }
  const rows = []
  for (let i = start; i < lines.length; i++) {
    const c = splitLine(lines[i])
    const symbol = c[idx.sym] || ''
    if (symbol) rows.push({ symbol, quantity: num(c[idx.qty]), buyPrice: num(c[idx.price]) })
  }
  return rows
}

export default function Portfolio() {
  const { holdings, addHolding, removeHolding } = usePortfolio()
  const { plan } = usePlan()
  const { portfolioMax, csvImport } = getLimits(plan)
  const navigate = useNavigate()

  const [market, setMarket] = useState([])
  const [coinId, setCoinId] = useState('')
  const [qty, setQty] = useState('')
  const [buy, setBuy] = useState('')
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const fileRef = useRef(null)

  // Top 100 para o seletor e para os preços atuais (uma chamada, com cache)
  useEffect(() => {
    fetchCoins(1, 100).then(setMarket).catch(() => {})
  }, [])

  const priceById = useMemo(() => new Map(market.map(c => [c.id, c])), [market])

  const rows = holdings.map(h => {
    const live = priceById.get(h.coinId)
    const price = live?.current_price
    const value = price != null ? h.quantity * price : null
    const cost = h.quantity * h.buyPrice
    const pnl = value != null ? value - cost : null
    const pnlPct = value != null && cost > 0 ? (pnl / cost) * 100 : null
    return { ...h, image: live?.image || h.image, price, value, cost, pnl, pnlPct }
  })

  const totalValue = rows.reduce((s, r) => s + (r.value || 0), 0)
  const totalCost = rows.reduce((s, r) => s + r.cost, 0)
  const totalPnl = totalValue - totalCost
  const totalPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0

  const onPickCoin = (id) => {
    setCoinId(id)
    const c = priceById.get(id)
    setBuy(c ? String(c.current_price) : '') // sugere o preço atual como preço de compra
  }

  const onAdd = (e) => {
    e.preventDefault()
    const c = priceById.get(coinId)
    const q = parseFloat(qty)
    const b = parseFloat(buy)
    if (!c || isNaN(q) || q <= 0 || isNaN(b) || b <= 0) return
    if (holdings.length >= portfolioMax) {
      setShowUpgrade(true)
      return
    }
    addHolding(c, q, b) // adiciona sempre um novo lote (permite várias compras)
    setCoinId(''); setQty(''); setBuy('')
  }

  // Resolve um símbolo → moeda (top 100 primeiro; senão pesquisa)
  const resolveCoin = async (symbol) => {
    const s = symbol.toLowerCase()
    const inMarket = market.find(c => c.symbol.toLowerCase() === s)
    if (inMarket) return inMarket
    try {
      const res = await searchCoins(symbol)
      const m = res.find(c => (c.symbol || '').toLowerCase() === s) || res[0]
      if (m) return { id: m.id, name: m.name, symbol: m.symbol, image: m.thumb }
    } catch { /* ignora */ }
    return null
  }

  const onImport = async (file) => {
    if (!file) return
    setImportMsg('A importar…')
    const text = await file.text()
    const csvRows = parseCSV(text)
    let added = 0, skipped = 0, capped = false
    for (const row of csvRows) {
      if (holdings.length + added >= portfolioMax) { capped = true; break }
      const coin = await resolveCoin(row.symbol)
      if (!coin || !(row.quantity > 0) || !(row.buyPrice > 0)) { skipped++; continue }
      addHolding(coin, row.quantity, row.buyPrice)
      added++
    }
    let msg = `✓ ${added} transações importadas`
    if (skipped) msg += ` · ${skipped} ignoradas (formato inválido)`
    if (capped) msg += ` · limite Free (${portfolioMax}) atingido — Pro é ilimitado`
    setImportMsg(msg)
  }

  const downloadTemplate = () => {
    const csv = 'symbol,quantidade,preco\nBTC,0.1,55000\nETH,2,3000\nSOL,10,120'
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url; a.download = 'modelo-portfolio.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const atalho = isFinite(portfolioMax)

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.title}>O Meu Portfolio</div>
        {atalho && (
          <div className={styles.usage}>
            {holdings.length}/{portfolioMax} · plano Free
            {holdings.length >= portfolioMax && <Link to="/planos" className={styles.upgradeLink}>upgrade →</Link>}
          </div>
        )}
      </div>

      {/* Resumo */}
      <div className={styles.summary}>
        <div className={styles.sumCard}>
          <div className={styles.sumLabel}>Valor atual</div>
          <div className={styles.sumValue}>{fmt(totalValue)}</div>
        </div>
        <div className={styles.sumCard}>
          <div className={styles.sumLabel}>Investido</div>
          <div className={styles.sumValue}>{fmt(totalCost)}</div>
        </div>
        <div className={styles.sumCard}>
          <div className={styles.sumLabel}>Lucro / Prejuízo</div>
          <div className={`${styles.sumValue} ${totalPnl >= 0 ? styles.green : styles.red}`}>
            {fmt(totalPnl)} <span className={styles.sumPct}>{fmtPct(totalPct)}</span>
          </div>
        </div>
      </div>

      {/* Adicionar posição */}
      <form className={styles.addForm} onSubmit={onAdd}>
        <select className={styles.select} value={coinId} onChange={e => onPickCoin(e.target.value)}>
          <option value="">Escolher cripto…</option>
          {market.map(c => (
            <option key={c.id} value={c.id}>{c.name} ({c.symbol.toUpperCase()})</option>
          ))}
        </select>
        <input className={styles.input} type="number" step="any" placeholder="Quantidade" value={qty} onChange={e => setQty(e.target.value)} />
        <input className={styles.input} type="number" step="any" placeholder="Preço médio ($)" value={buy} onChange={e => setBuy(e.target.value)} />
        <button className={styles.addBtn} type="submit">Adicionar</button>
      </form>

      {/* Importar CSV — exclusivo Trader */}
      <div className={styles.importRow}>
        {csvImport ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={e => { onImport(e.target.files[0]); e.target.value = '' }}
            />
            <button className={styles.importBtn} onClick={() => fileRef.current?.click()}>📄 Importar transações (CSV)</button>
            <button className={styles.linkBtn} onClick={downloadTemplate}>descarregar modelo</button>
            {importMsg && <span className={styles.importMsg}>{importMsg}</span>}
          </>
        ) : (
          <button className={styles.importLocked} onClick={() => navigate('/planos')} title="Importação por CSV exclusiva do plano Trader">
            📄 Importar transações (CSV) <span className={styles.lockBadge}>🔒 Trader</span>
          </button>
        )}
      </div>

      {/* Lista */}
      {rows.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>💼</div>
          <div className={styles.emptyText}>Adiciona as tuas posições acima para veres o lucro/prejuízo ao vivo.</div>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Cripto</th>
                <th style={{ textAlign: 'right' }}>Qtd.</th>
                <th style={{ textAlign: 'right' }}>Preço médio</th>
                <th style={{ textAlign: 'right' }}>Preço atual</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
                <th style={{ textAlign: 'right' }}>L/P</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td>
                    <div className={styles.coin}>
                      {r.image && <img src={r.image} alt={r.name} width={22} height={22} />}
                      <div>
                        <div className={styles.coinName}>{r.name}</div>
                        <div className={styles.coinSym}>{r.symbol?.toUpperCase()}</div>
                      </div>
                    </div>
                  </td>
                  <td className={styles.num}>{r.quantity}</td>
                  <td className={styles.num}>{fmt(r.buyPrice)}</td>
                  <td className={styles.num}>{fmt(r.price)}</td>
                  <td className={styles.num}>{fmt(r.value)}</td>
                  <td className={`${styles.num} ${r.pnl == null ? '' : r.pnl >= 0 ? styles.green : styles.red}`}>
                    {fmt(r.pnl)}<div className={styles.pnlPct}>{fmtPct(r.pnlPct)}</div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className={styles.removeBtn} onClick={() => removeHolding(r.id)} title="Eliminar posição">✕ eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showUpgrade && (
        <UpgradeModal
          title={`Portfolio limitado a ${portfolioMax} no plano Free`}
          message="Faz upgrade para Pro e acompanha um portfolio ilimitado com lucro/prejuízo ao vivo."
          onClose={() => setShowUpgrade(false)}
        />
      )}
    </div>
  )
}
