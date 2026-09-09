import { useEffect, useState, type FormEvent } from 'react'
import EvilEye from './EvilEye'
import { Icon } from './UI'
import { loadProfiles, verifyProfilePin } from '../lib/ev0l'
import './GuestAdminLock.css'

type Props = {
  onBack: () => void
  onUnlock?: () => void
  inline?: boolean
  title?: string
  subtitle?: string
}

const SECRETS = [
  'System power',
  'Server controls',
  'Provider configuration',
  'Ghost Sentry',
  'API endpoints & secrets',
]

export default function GuestAdminLock({
  onBack,
  onUnlock,
  inline = false,
  title = 'Nice try, guest.',
  subtitle = 'Owner controls are under observation. Authenticate as Omar to reveal them.',
}: Props) {
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [watched, setWatched] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setWatched(true), 900)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (inline) return
    const previousOverflow = document.body.style.overflow
    const previousOverscroll = document.body.style.overscrollBehavior
    document.body.style.overflow = 'hidden'
    document.body.style.overscrollBehavior = 'none'
    return () => {
      document.body.style.overflow = previousOverflow
      document.body.style.overscrollBehavior = previousOverscroll
    }
  }, [inline])

  async function unlock(event: FormEvent) {
    event.preventDefault()
    if (busy) return

    if (!/^\d{4,8}$/.test(pin)) {
      setError('Enter the 4 to 8 digit Omar PIN.')
      return
    }

    const omar = loadProfiles().find((profile) => profile.id === 'omar')
    if (!omar?.pinHash) {
      setError('Owner authentication is unavailable.')
      return
    }

    try {
      setBusy(true)
      setError('')
      const accepted = await verifyProfilePin(omar, pin)
      if (!accepted) {
        setError('Authentication rejected. The eye noticed.')
        setPin('')
        return
      }
      onUnlock?.()
    } catch {
      setError('Unable to verify owner authentication.')
    } finally {
      setBusy(false)
    }
  }

  const content = (
    <section className="guest-admin-lock__panel" aria-labelledby="guest-admin-lock-title">
      <button className="guest-admin-lock__close" type="button" onClick={onBack} aria-label="Close owner controls">
        <Icon name="close" size={20} />
      </button>

      <div className="guest-admin-lock__eye" aria-hidden="true">
        <EvilEye
          eyeColor="#7F8B95"
          intensity={0.9}
          pupilSize={0.62}
          irisWidth={0.22}
          glowIntensity={0.16}
          scale={0.78}
          noiseScale={1.05}
          pupilFollow={0.8}
          flameSpeed={0.55}
          backgroundColor="#050607"
        />
        <span>{watched ? 'ACCESS OBSERVED' : 'SCANNING SESSION'}</span>
      </div>

      <div className="guest-admin-lock__copy">
        <span className="eyebrow">Owner controls</span>
        <h1 id="guest-admin-lock-title">{title}</h1>
        <p>{subtitle}</p>
      </div>

      <div className="guest-admin-lock__secrets" aria-label="Hidden administrator settings">
        {SECRETS.map((secret) => (
          <div className="guest-secret" key={secret}>
            <span className="guest-secret__eye">◉</span>
            <span>{secret}</span>
            <strong>HIDDEN</strong>
          </div>
        ))}
      </div>

      <form className="guest-admin-lock__auth" onSubmit={unlock}>
        <label htmlFor="guest-admin-pin">Owner authentication</label>
        <div className="guest-admin-lock__input">
          <Icon name="lock" size={17} />
          <input
            id="guest-admin-pin"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            type="password"
            maxLength={8}
            value={pin}
            onChange={(event) => {
              setPin(event.target.value.replace(/\D/g, ''))
              setError('')
            }}
            placeholder="Enter Omar PIN"
            aria-describedby={error ? 'guest-admin-pin-error' : undefined}
          />
        </div>
        {error && <small id="guest-admin-pin-error">{error}</small>}
        <button className="button button--subtle guest-admin-lock__unlock" type="submit" disabled={busy}>
          {busy ? 'VERIFYING' : 'UNLOCK OWNER CONTROLS'}
          <Icon name="arrow" size={16} />
        </button>
      </form>

      <div className="guest-admin-lock__footer">
        <span><i />Guest session detected · surveillance active</span>
        <button className="button button--subtle" type="button" onClick={onBack}>
          <Icon name="back" />
          Back to EV0L
        </button>
      </div>
    </section>
  )

  if (inline) {
    return (
      <div className="guest-admin-lock guest-admin-lock--inline">
        <div className="guest-admin-lock__veil" aria-hidden="true" />
        {content}
      </div>
    )
  }

  return (
    <main className="guest-admin-lock">
      <div className="guest-admin-lock__veil" aria-hidden="true" />
      {content}
    </main>
  )
}
