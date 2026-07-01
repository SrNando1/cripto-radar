import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { PlanProvider } from './context/PlanContext'
import { CoinsProvider } from './context/CoinsContext'
import { WatchlistProvider } from './context/WatchlistContext'
import { PortfolioProvider } from './context/PortfolioContext'
import { AlertsProvider } from './context/AlertsContext'
import AlertWatcher from './components/AlertWatcher'
import ProtectedRoute from './components/ProtectedRoute'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import Watchlist from './pages/Watchlist'
import Portfolio from './pages/Portfolio'
import Alertas from './pages/Alertas'
import Planos from './pages/Planos'
import Conta from './pages/Conta'
import './App.css'

export default function App() {
  return (
    <AuthProvider>
      <PlanProvider>
      <CoinsProvider>
        <WatchlistProvider>
          <PortfolioProvider>
          <AlertsProvider>
            <BrowserRouter>
              <AlertWatcher />
              <Navbar />
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/watchlist" element={<ProtectedRoute><Watchlist /></ProtectedRoute>} />
                <Route path="/portfolio" element={<Portfolio />} />
                <Route path="/alertas" element={<Alertas />} />
                <Route path="/planos" element={<Planos />} />
                <Route path="/conta" element={<Conta />} />
              </Routes>
            </BrowserRouter>
          </AlertsProvider>
          </PortfolioProvider>
        </WatchlistProvider>
      </CoinsProvider>
      </PlanProvider>
    </AuthProvider>
  )
}
