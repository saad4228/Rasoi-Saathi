import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    if (!supabase) {
      setError('Supabase is not configured for this frontend.')
      setBusy(false)
      return
    }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email)
    if (resetError) setError('We could not send that reset email. Please check the address and try again.')
    else setMessage('If an account exists for that email, a reset link is on its way.')
    setBusy(false)
  }

  return (
    <main className="auth-centered">
      <div className="auth-card">
        <Link className="brand brand-dark" to="/login"><span className="brand-mark">RS</span> Rasoi Sathi</Link>
        <span className="eyebrow">ACCOUNT RECOVERY</span>
        <h2>Reset your password</h2>
        <p className="muted">Supabase Auth will send a secure recovery link to your inbox.</p>
        {error && <div className="form-alert" role="alert">{error}</div>}
        {message && <div className="form-success" role="status">{message}</div>}
        <form onSubmit={handleSubmit} className="auth-form">
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <button className="button button-primary button-wide" disabled={busy}>{busy ? 'Sending...' : 'Send reset link'}</button>
        </form>
        <Link className="back-link" to="/login">Back to sign in</Link>
      </div>
    </main>
  )
}
