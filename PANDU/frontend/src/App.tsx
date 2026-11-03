import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './utils/supabase.js'
import Login from './pages/Login'
import './App.css'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [startupError, setStartupError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')

  useEffect(() => {
    let active = true
    let receivedAuthEvent = false

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      receivedAuthEvent = true
      setSession(nextSession)
      setStartupError('')
      setLoading(false)
    })

    async function loadSession() {
      const {
        data: { session: currentSession },
        error,
      } = await supabase.auth.getSession()

      if (!active || receivedAuthEvent) return

      if (error) {
        setStartupError(`Couldn't check your sign-in status: ${error.message}`)
      } else {
        setSession(currentSession)
        setStartupError('')
      }

      setLoading(false)
    }

    void loadSession().catch((error: unknown) => {
      if (!active || receivedAuthEvent) return
      const message = error instanceof Error ? error.message : 'An unexpected error occurred.'
      setStartupError(`Couldn't check your sign-in status: ${message}`)
      setLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [retryCount])

  async function handleLogout() {
    setLogoutError('')
    setLoggingOut(true)

    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred.'
      setLogoutError(`Couldn't sign out: ${message}`)
    } finally {
      setLoggingOut(false)
    }
  }

  if (loading) {
    return (
      <main className="app-screen" aria-live="polite">
        <div className="loading-orb" />
        <p className="muted-text">Starting PANDU…</p>
      </main>
    )
  }

  if (startupError) {
    return (
      <main className="app-screen">
        <section className="status-card" role="alert">
          <div className="brand-orb" aria-hidden="true" />
          <h1>PANDU</h1>
          <p className="error-message">{startupError}</p>
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              setStartupError('')
              setLoading(true)
              setRetryCount((count) => count + 1)
            }}
          >
            Try again
          </button>
        </section>
      </main>
    )
  }

  if (!session) return <Login />

  return (
    <main className="app-screen">
      <section className="home-card">
        <div className="brand-orb" aria-hidden="true" />
        <p className="eyebrow">PANDU</p>
        <h1>Home</h1>
        <p className="muted-text">
          Signed in{session.user.email ? ` as ${session.user.email}` : ''}.
        </p>
        {logoutError && <p className="error-message" role="alert">{logoutError}</p>}
        <button
          className="primary-button"
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? 'Signing out…' : 'Log out'}
        </button>
      </section>
    </main>
  )
}
