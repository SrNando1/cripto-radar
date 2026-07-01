import { Link, useLocation } from 'react-router-dom'
import { useWatchlist } from '../context/WatchlistContext'
import { useAlerts } from '../context/AlertsContext'
import { useAuth } from '../context/AuthContext'
import styles from './Navbar.module.css'

export default function Navbar() {
  const { pathname } = useLocation()
  const { watchlist } = useWatchlist()
  const { activeCount } = useAlerts()
  const { user } = useAuth()

  return (
    <nav className={styles.nav}>
      <div className={styles.logo}>
        <span className={styles.dot} />
        <span className={styles.brand}>CRIPTORADAR</span>
        <span className={styles.badge}>BETA</span>
      </div>
      <div className={styles.links}>
        <Link to="/" className={pathname === '/' ? styles.active : ''}>Dashboard</Link>
        <Link to="/watchlist" className={pathname === '/watchlist' ? styles.active : ''}>
          Watchlist {watchlist.length > 0 && <span className={styles.count}>{watchlist.length}</span>}
        </Link>
        <Link to="/portfolio" className={pathname === '/portfolio' ? styles.active : ''}>Portfolio</Link>
        <Link to="/alertas" className={pathname === '/alertas' ? styles.active : ''}>
          Alertas {activeCount > 0 && <span className={styles.count}>{activeCount}</span>}
        </Link>
        <Link to="/planos" className={pathname === '/planos' ? styles.active : ''}>Planos</Link>
        <Link to="/conta" className={`${styles.contaLink} ${pathname === '/conta' ? styles.active : ''}`}>
          {user ? (
            <span className={styles.userChip}>{user.email?.[0]?.toUpperCase()}</span>
          ) : (
            'Entrar'
          )}
        </Link>
      </div>
    </nav>
  )
}
