import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { AuthContext } from './auth-context'

function authConfigurationError() {
  return new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [applicationUser, setApplicationUser] = useState(null)
  const [loading, setLoading] = useState(supabaseConfigured)
  const [error, setError] = useState(() => (supabaseConfigured ? null : authConfigurationError()))

  async function loadApplicationUser(nextSession) {
    if (!nextSession) {
      setApplicationUser(null)
      return null
    }

    try {
      const profile = await api.get('/api/auth/me', nextSession)
      setApplicationUser(profile)
      setError(null)
      return profile
    } catch (requestError) {
      setApplicationUser(null)
      setError(requestError)
      throw requestError
    }
  }

  useEffect(() => {
    if (!supabaseConfigured) {
      return undefined
    }

    let mounted = true
    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      if (!mounted) return
      setSession(currentSession)
      setUser(currentSession?.user ?? null)
      if (currentSession) {
        try {
          await loadApplicationUser(currentSession)
        } catch {
          // The protected route presents the profile-loading error state.
        }
      }
      if (mounted) setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      if (!nextSession) {
        setApplicationUser(null)
        setError(null)
        return
      }
      if (event !== 'INITIAL_SESSION') {
        loadApplicationUser(nextSession).catch(() => {})
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function signIn(email, password) {
    if (!supabase) throw authConfigurationError()
    setError(null)
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) throw signInError
    let profile = null
    try {
      profile = await loadApplicationUser(data.session)
    } catch (requestError) {
      if (requestError.status !== 401) throw requestError
    }
    return { ...data, applicationUser: profile }
  }

  async function signUp(email, password, restaurant) {
    if (!supabase) throw authConfigurationError()
    setError(null)
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) throw signUpError
    if (data.session) {
      await api.post('/api/auth/onboarding', restaurant, data.session)
      await loadApplicationUser(data.session)
    }
    return data
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    setApplicationUser(null)
    setError(null)
  }

  async function refreshUser() {
    if (!session) return null
    return loadApplicationUser(session)
  }

  return (
    <AuthContext.Provider value={{
      session,
      user,
      applicationUser,
      loading,
      error,
      signIn,
      signUp,
      signOut,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

