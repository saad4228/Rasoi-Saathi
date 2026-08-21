import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

function friendlyError(error) {
  if (error?.message?.toLowerCase().includes('already registered')) return 'That email is already registered. Try signing in.'
  return error?.message || 'We could not create your workspace. Please try again.'
}

export default function SignupPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '', restaurant_name: '', restaurant_email: '', restaurant_phone: '' })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  function update(field) {
    return (event) => setForm((current) => ({ ...current, [field]: event.target.value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const { session } = await signUp(form.email, form.password, {
        restaurant_name: form.restaurant_name,
        restaurant_email: form.restaurant_email || null,
        restaurant_phone: form.restaurant_phone || null,
      })
      if (session) navigate('/dashboard', { replace: true })
      else {
        sessionStorage.setItem('pending_onboarding', JSON.stringify({
          restaurant_name: form.restaurant_name,
          restaurant_email: form.restaurant_email || null,
          restaurant_phone: form.restaurant_phone || null,
        }))
        setMessage('Check your inbox to confirm your email, then return here to sign in.')
      }
    } catch (requestError) {
      setError(friendlyError(requestError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-shell auth-shell-reverse">
      <section className="auth-panel">
        <div className="auth-panel-inner">
          <Link className="brand brand-dark" to="/login"><span className="brand-mark">RS</span> Rasoi Sathi</Link>
          <span className="eyebrow">START WITH A CLEARER SERVICE</span>
          <h2>Create your workspace</h2>
          <p className="muted">Your Supabase account becomes the owner of this restaurant workspace.</p>
          {error && <div className="form-alert" role="alert">{error}</div>}
          {message && <div className="form-success" role="status">{message}</div>}
          <form onSubmit={handleSubmit} className="auth-form">
            <label>Your email<input type="email" value={form.email} onChange={update('email')} autoComplete="email" required /></label>
            <label>Password<input type="password" value={form.password} onChange={update('password')} autoComplete="new-password" minLength="6" required /></label>
            <label>Restaurant name<input value={form.restaurant_name} onChange={update('restaurant_name')} required /></label>
            <div className="form-grid">
              <label>Restaurant email<input type="email" value={form.restaurant_email} onChange={update('restaurant_email')} /></label>
              <label>Phone<input value={form.restaurant_phone} onChange={update('restaurant_phone')} /></label>
            </div>
            <button className="button button-primary button-wide" disabled={busy}>{busy ? 'Creating workspace...' : 'Create workspace'}</button>
          </form>
          <p className="auth-footer">Already have a workspace? <Link to="/login">Sign in</Link></p>
        </div>
      </section>
      <section className="auth-art auth-art-quiet">
        <span className="eyebrow">OWNER ONBOARDING</span>
        <h1>Start with the whole picture.</h1>
        <p>Your account is the identity. Your application profile carries the restaurant role and scope.</p>
        <div className="art-grid"><span>Menu</span><span>Inventory</span><span>People</span><span>Forecasts</span></div>
      </section>
    </main>
  )
}
