import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePlan } from '../context/PlanContext'
import { useWatchlist } from '../context/WatchlistContext'
import { useAlerts } from '../context/AlertsContext'
import styles from './Conta.module.css'

// Traduz os erros mais comuns do Supabase para PT.
function traduzErro(message) {
  const m = message?.toLowerCase() || ''
  if (m.includes('invalid login credentials')) return 'Email ou password incorretos.'
  if (m.includes('already registered')) return 'Já existe uma conta com este email.'
  if (m.includes('password should be at least')) return 'A password deve ter pelo menos 6 caracteres.'
  if (m.includes('valid email')) return 'Email inválido.'
  if (m.includes('rate limit')) return 'Demasiadas tentativas. Aguarda um pouco e tenta de novo.'
  if (m.includes('email not confirmed')) return 'Confirma primeiro o teu email (vê a caixa de entrada).'
  return message || 'Ocorreu um erro. Tenta novamente.'
}

export default function Conta() {
  const { user, loading, signUp, signIn, signInWithGoogle, signOut, isConfigured } = useAuth()
  const { plan, isPaid } = usePlan()
  const { watchlist, synced: wlSynced } = useWatchlist()
  const { alerts, synced: alSynced } = useAlerts()
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const location = useLocation()
  const navigate = useNavigate()
  const from = location.state?.from // rota protegida que originou o redirecionamento

  if (!isConfigured) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.title}>Autenticação não configurada</div>
          <div className={styles.setupText}>
            Para ativar contas de utilizador:
            <ol className={styles.setupSteps}>
              <li>Cria um projeto gratuito em <b>supabase.com</b></li>
              <li>Vai a <b>Project Settings → API</b></li>
              <li>Copia o URL e a anon key para o ficheiro <code>.env</code>:</li>
            </ol>
            <pre className={styles.code}>VITE_SUPABASE_URL=https://xxxx.supabase.co{'\n'}VITE_SUPABASE_ANON_KEY=eyJ...</pre>
            <div className={styles.setupNote}>Depois reinicia o <code>npm run dev</code>.</div>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className={styles.page}><div className={styles.loading}>A verificar sessão...</div></div>
  }

  // Sessão iniciada — mostra a conta
  if (user) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.avatar}>{user.email?.[0]?.toUpperCase()}</div>
          <div className={styles.title}>{user.email}</div>
          <div className={`${styles.sub} ${isPaid ? styles.planPaid : ''}`}>
            Plano {plan === 'trader' ? 'Trader' : plan === 'pro' ? 'Pro' : 'Free'}
            {isPaid && (
              <> · <a href="https://app.lemonsqueezy.com/my-orders" target="_blank" rel="noreferrer" className={styles.manageLink}>gerir subscrição</a></>
            )}
          </div>

          <div className={styles.stats}>
            <div className={styles.stat}>
              <div className={styles.statNum}>{watchlist.length}</div>
              <div className={styles.statLabel}>na watchlist</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statNum}>{alerts.filter(a => !a.triggered).length}</div>
              <div className={styles.statLabel}>alertas ativos</div>
            </div>
          </div>

          <div className={styles.syncStatus}>
            {wlSynced && alSynced
              ? '☁️ Watchlist e alertas sincronizados na cloud'
              : 'A sincronizar... (corre o schema.sql no Supabase se persistir)'}
          </div>

          <button className={styles.secondaryBtn} onClick={signOut}>Terminar sessão</button>
        </div>
      </div>
    )
  }

  const loginGoogle = async () => {
    setError(null)
    setInfo(null)
    try {
      const { error: err } = await signInWithGoogle()
      if (err) throw err
      // O browser é redirecionado para o Google; ao voltar, a sessão é detetada automaticamente.
    } catch (err) {
      setError(traduzErro(err.message))
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      if (mode === 'signup') {
        const { error: err } = await signUp(email, password)
        if (err) throw err
        setInfo('Conta criada! Verifica o teu email para confirmar o registo.')
      } else {
        const { error: err } = await signIn(email, password)
        if (err) throw err
        if (from) navigate(from, { replace: true })
      }
    } catch (err) {
      setError(traduzErro(err.message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.title}>
          {mode === 'login' ? 'Entrar no CriptoRadar' : 'Criar conta'}
        </div>
        <div className={styles.sub}>
          {mode === 'login' ? 'A tua watchlist e alertas, em qualquer dispositivo.' : 'Grátis. Sem cartão de crédito.'}
        </div>

        {from && (
          <div className={styles.notice}>
            🔒 Inicia sessão para acederes {from === '/watchlist' ? 'à tua Watchlist' : 'a essa página'}.
          </div>
        )}

        <button className={styles.googleBtn} onClick={loginGoogle} type="button">
          <svg width="16" height="16" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/>
          </svg>
          Continuar com Google
        </button>

        <div className={styles.divider}><span>ou</span></div>

        <form onSubmit={submit} className={styles.form}>
          <input
            className={styles.input}
            type="email"
            placeholder="email@exemplo.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus
          />
          <input
            className={styles.input}
            type="password"
            placeholder="password (mín. 6 caracteres)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
          />

          {error && <div className={styles.error}>{error}</div>}
          {info && <div className={styles.info}>{info}</div>}

          <button className={styles.submitBtn} type="submit" disabled={busy}>
            {busy ? 'Aguarda...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <div className={styles.switch}>
          {mode === 'login' ? (
            <>Ainda não tens conta? <button onClick={() => { setMode('signup'); setError(null); setInfo(null) }}>Regista-te</button></>
          ) : (
            <>Já tens conta? <button onClick={() => { setMode('login'); setError(null); setInfo(null) }}>Entra</button></>
          )}
        </div>
      </div>
    </div>
  )
}
