import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { useAuth } from '../hooks/useAuth'

function friendlyError(error) {
  if (error?.status === 401) return 'Your account is not active in Rasoi Sathi yet.'
  if (error?.message?.toLowerCase().includes('invalid login')) return 'That email or password is incorrect.'
  if (error?.message?.toLowerCase().includes('email not confirmed')) return 'Confirm your email before signing in.'
  return error?.message || 'We could not sign you in. Please try again.'
}

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const authResult = await signIn(email, password)
      const pendingOnboarding = sessionStorage.getItem('pending_onboarding')
      if (!authResult.applicationUser && pendingOnboarding) {
        await api.post('/api/auth/onboarding', JSON.parse(pendingOnboarding), authResult.session)
        sessionStorage.removeItem('pending_onboarding')
      }
      navigate(location.state?.from?.pathname || '/dashboard', { replace: true })
    } catch (requestError) {
      setError(friendlyError(requestError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-art" aria-label="Rasoi Sathi workspace">
        <Link className="brand brand-on-art" to="/login"><span className="brand-mark">RS</span> Rasoi Sathi</Link>
        <div className="art-copy">
          <span className="eyebrow">RESTAURANT OPERATIONS, IN ONE PLACE</span>
          <h1>Make every service feel considered.</h1>
          <p>Bring menus, people, inventory, and daily decisions into a calmer rhythm.</p>
        </div>
        <div className="art-stat"><strong>14</strong><span>connected operational data layers</span></div>
      </section>
      <section className="auth-panel">
        <div className="auth-panel-inner">
          <span className="eyebrow">WELCOME BACK</span>
          <h2>Sign in to your workspace</h2>
          <p className="muted">Use the email and password managed by Supabase Auth.</p>
          {error && <div className="form-alert" role="alert">{error}</div>}
          <form onSubmit={handleSubmit} className="auth-form">
            <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
            <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
            <div className="form-row"><span /> <Link to="/forgot-password">Forgot password?</Link></div>
            <button className="button button-primary button-wide" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
          </form>
          <p className="auth-footer">New to Rasoi Sathi? <Link to="/signup">Create a workspace</Link></p>
        </div>
      </section>
    </main>
  )
}
