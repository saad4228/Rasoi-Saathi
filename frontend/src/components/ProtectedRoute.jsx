import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function ProtectedRoute() {
  const { session, applicationUser, loading, error } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="screen-state"><span className="loader" />Loading your workspace</div>
  }

  if (!session) return <Navigate to="/login" replace state={{ from: location }} />

  if (error || !applicationUser) {
    return (
      <div className="screen-state screen-state-error">
        <span className="eyebrow">PROFILE ACCESS</span>
        <h1>We could not load your workspace</h1>
        <p>Refresh your session or contact the restaurant owner to activate your application profile.</p>
        <button type="button" className="button button-primary" onClick={() => window.location.reload()}>Try again</button>
      </div>
    )
  }

  return <Outlet />
}
