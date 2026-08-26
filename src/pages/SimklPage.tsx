import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  beginSimklLogin,
  finishSimklLogin,
  getSimklStatus,
  loadSimklAuth,
  logoutSimkl,
  simklStatusLabel,
  syncSimkl,
  type SimklStatus,
} from '../lib/simkl'

export default function SimklPage() {
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState<SimklStatus>(getSimklStatus())
  const [user, setUser] = useState(loadSimklAuth()?.user || null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const code = params.get('code')
    const state = params.get('state')
    const oauthError = params.get('error')
    if (!code && !oauthError) return

    setBusy(true)
    setError('')
    setMessage('Finishing Simkl login…')

    if (oauthError) {
      setError(`Simkl authorization was not completed${params.get('error_description') ? `: ${params.get('error_description')}` : '.'}`)
      setBusy(false)
      setParams({}, { replace: true })
      return
    }

    finishSimklLogin(code || '', state || '')
      .then((nextUser) => {
        setUser(nextUser)
        setStatus('connected')
        setMessage('Simkl connected successfully.')
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Simkl login failed.')
      })
      .finally(() => {
        setBusy(false)
        setParams({}, { replace: true })
      })
  }, [params, setParams])

  async function connect() {
    setBusy(true)
    setError('')
    try {
      await beginSimklLogin()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start Simkl login.')
      setBusy(false)
    }
  }

  function disconnect() {
    logoutSimkl()
    setUser(null)
    setStatus(getSimklStatus())
    setMessage('Simkl disconnected from this browser.')
  }

  async function syncNow() {
    setBusy(true)
    setError('')
    setMessage('Syncing EV0L with Simkl…')
    try {
      const result = await syncSimkl()
      setMessage(`Sync complete · ${result.pushedWatchlist} watchlist + ${result.pushedHistory} history sent · ${result.importedWatchlist} watchlist + ${result.importedHistory} history imported.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simkl sync failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Connection</span>
          <h1>Simkl</h1>
          <p>Sync your EV0L watchlist and viewing history with your Simkl account.</p>
        </div>
        <Link className="button button--subtle" to="/settings">Back to Settings</Link>
      </div>

      <section className="settings-section" style={{ maxWidth: '760px' }}>
        <div className="provider-row">
          <span>Status</span>
          <strong>{simklStatusLabel(status)}</strong>
        </div>

        {user && (
          <div className="provider-row">
            <span>Account</span>
            <strong>{user.name || user.account || 'Simkl user'}</strong>
          </div>
        )}

        {status === 'not-configured' && (
          <p>Simkl is not configured for this EV0L build yet. Add a public Simkl client ID as <code>VITE_SIMKL_CLIENT_ID</code> and register the redirect URI <code>{window.location.origin}/simkl/callback</code> (or provide <code>VITE_SIMKL_REDIRECT_URI</code>).</p>
        )}

        {error && <p className="inline-error">{error}</p>}
        {message && <p>{message}</p>}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {status !== 'connected' ? (
            <button className="button button--primary" onClick={connect} disabled={busy || status === 'not-configured'}>
              {busy ? 'Connecting…' : 'Connect Simkl'}
            </button>
          ) : (
            <>
              <button className="button button--primary" onClick={syncNow} disabled={busy}>
                {busy ? 'Syncing…' : 'Sync now'}
              </button>
              <button className="button button--subtle" onClick={disconnect} disabled={busy}>
                Disconnect
              </button>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
