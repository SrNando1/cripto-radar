import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePlan } from '../context/PlanContext'
import styles from './Planos.module.css'

// Links de checkout do LemonSqueezy (botão "Share" do produto)
const CHECKOUT_URLS = {
  pro: import.meta.env.VITE_LS_CHECKOUT_PRO,
  trader: import.meta.env.VITE_LS_CHECKOUT_TRADER,
}

function checkoutUrl(planoId, user) {
  const base = CHECKOUT_URLS[planoId]
  if (!base) return null
  const url = new URL(base)
  // Pré-preenche o email e anexa o user_id — o webhook usa-o para ativar o plano certo
  url.searchParams.set('checkout[email]', user.email)
  url.searchParams.set('checkout[custom][user_id]', user.id)
  return url.toString()
}

const PLANOS = [
  {
    id: 'free',
    nome: 'Free',
    preco: '0€',
    periodo: 'para sempre',
    descricao: 'Começa a monitorizar o mercado',
    features: ['Top 20 criptomoedas', 'Gráfico histórico básico', 'Watchlist até 5 criptos', 'Dados atualizados a cada 60s'],
    cta: 'Começar grátis',
    destaque: false,
  },
  {
    id: 'pro',
    nome: 'Pro',
    preco: '3€',
    periodo: '/mês',
    descricao: 'Para traders e investidores sérios',
    features: ['Top 250 criptomoedas', 'Gráficos avançados (até 1 ano)', 'Watchlist e portfolio ilimitados', 'Alertas de preço por email', 'Dados atualizados a cada 10s', 'Tendência IA'],
    cta: 'Começar Pro',
    destaque: true,
  },
  {
    id: 'trader',
    nome: 'Trader',
    preco: '15€',
    periodo: '/mês',
    descricao: 'Para uso profissional',
    features: ['Tudo do Pro', '🔍 Todas as criptomoedas (pesquisa de 17.000+)', 'Watchlist e portfolio ilimitados', 'Alertas de preço por email', 'Dados a cada 10s'],
    cta: 'Começar Trader',
    destaque: false,
  },
]

export default function Planos() {
  const { user } = useAuth()
  const { plan } = usePlan()
  const navigate = useNavigate()

  const onCta = (plano) => {
    if (plano.id === 'free') {
      navigate(user ? '/' : '/conta')
      return
    }
    if (!user) {
      navigate('/conta', { state: { from: '/planos' } })
      return
    }
    const url = checkoutUrl(plano.id, user)
    if (!url) {
      alert('Checkout ainda não configurado. Define VITE_LS_CHECKOUT_PRO e VITE_LS_CHECKOUT_TRADER no .env (links "Share" dos produtos no LemonSqueezy).')
      return
    }
    window.location.href = url
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.title}>Planos simples e transparentes</div>
        <div className={styles.sub}>Começa grátis. Escala quando precisares.</div>
      </div>
      <div className={styles.grid}>
        {PLANOS.filter(p => !p.hidden).map(plano => {
          const atual = plan === plano.id
          return (
            <div key={plano.id} className={`${styles.card} ${plano.destaque ? styles.destaque : ''}`}>
              {plano.destaque && <div className={styles.badge}>Mais popular</div>}
              <div className={styles.planNome}>{plano.nome}</div>
              <div className={styles.planPreco}>
                {plano.preco}
                <span className={styles.planPeriodo}>{plano.periodo}</span>
              </div>
              <div className={styles.planDesc}>{plano.descricao}</div>
              <ul className={styles.features}>
                {plano.features.map(f => (
                  <li key={f}><span className={styles.check}>✓</span>{f}</li>
                ))}
              </ul>
              <button
                className={`${styles.cta} ${plano.destaque ? styles.ctaDestaque : ''}`}
                onClick={() => onCta(plano)}
                disabled={atual}
              >
                {atual ? '✓ O teu plano' : plano.cta}
              </button>
            </div>
          )
        })}
      </div>
      <div className={styles.footer}>
        Pagamento seguro via LemonSqueezy · Cancela quando quiseres · Sem contratos
      </div>
    </div>
  )
}
