import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Protege uma rota: sem sessão, redireciona para /conta (com o caminho de
 * origem em state, para voltar depois do login). Sem Supabase configurado
 * não há contas — deixa passar (modo local de desenvolvimento).
 */
export default function ProtectedRoute({ children }) {
  const { user, loading, isConfigured } = useAuth()
  const location = useLocation()

  if (!isConfigured) return children

  if (loading) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', fontSize: 13, color: '#555' }}>
        A verificar sessão...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/conta" replace state={{ from: location.pathname }} />
  }

  return children
}
