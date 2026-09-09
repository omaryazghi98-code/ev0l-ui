import { useEffect, useState, type FormEvent } from 'react'
import { Icon } from './UI'
import type { Profile } from '../lib/ev0l'
import '../styles/profile-lock.css'

type Props = {
  profile: Profile
  onCancel: () => void
  onUnlock: (password: string) => Promise<boolean> | boolean
}

export default function ProfileUnlockGate({ profile, onCancel, onUnlock }: Props) {
  const [password, setPassword] = useState('')
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [message, setMessage] = useState('Enter the profile password to continue.')
  const [shake, setShake] = useState(false)
  const [busy, setBusy] = useState(false)
  const [touchMode, setTouchMode] = useState(false)

  useEffect(() => {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0
    setTouchMode(coarse)
  }, [])

  function runAway() {
    if (password.trim()) return
    if (touchMode) {
      setShake(false)
      requestAnimationFrame(() => setShake(true))
      setMessage('Locked profile — enter the password first.')
      return
    }

    const x = Math.round((Math.random() * 2 - 1) * 84)
    const y = Math.round((Math.random() * 2 - 1) * 28)
    setOffset({ x, y })
    setMessage('Almost there — enter the password first.')
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault()
    if (busy) return

    if (!password.trim()) {
      runAway()
      return
    }

    try {
      setBusy(true)
      setMessage('Checking profile…')
      const accepted = await onUnlock(password)
      if (accepted) {
        setMessage('Unlocked.')
        onCancel()
        return
      }
      setOffset({ x: 0, y: 0 })
      setShake(false)
      requestAnimationFrame(() => setShake(true))
      setMessage('That password does not match this profile.')
    } catch {
      setOffset({ x: 0, y: 0 })
      setShake(false)
      requestAnimationFrame(() => setShake(true))
      setMessage('Unable to verify the profile right now.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="profile-lock" role="presentation" onMouseDown={onCancel}>
      <section className={`profile-lock__card${shake ? ' profile-lock__card--shake' : ''}`} role="dialog" aria-modal="true" aria-labelledby="profile-lock-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="profile-lock__ambient profile-lock__ambient--one" />
        <div className="profile-lock__ambient profile-lock__ambient--two" />

        <header className="profile-lock__top">
          <div className="profile-lock__identity">
            <span className="profile-lock__avatar">{profile.avatar || profile.name[0]}</span>
            <div>
              <span className="eyebrow">Protected profile</span>
              <strong>{profile.name}</strong>
            </div>
          </div>
          <button className="icon-button" type="button" onClick={onCancel} aria-label="Cancel">
            <Icon name="close" />
          </button>
        </header>

        <div className="profile-lock__copy">
          <span className="profile-lock__lock"><Icon name="lock" size={20} /></span>
          <h2 id="profile-lock-title">Private space</h2>
          <p>This profile is protected. Enter its password to continue.</p>
        </div>

        <form onSubmit={submit} noValidate>
          <label className="profile-lock__label" htmlFor="profile-password">Password</label>
          <div className="profile-lock__input">
            <Icon name="lock" size={17} />
            <input id="profile-password" autoFocus type="password" autoComplete="current-password" value={password} onChange={(event) => { setPassword(event.target.value); setMessage('Enter the profile password to continue.') }} placeholder="Enter password" />
          </div>

          <div className="profile-lock__button-stage">
            <button
              className="profile-lock__button"
              type="submit"
              disabled={busy}
              style={touchMode ? undefined : { transform: `translate(${offset.x}px, ${offset.y}px)` }}
              onMouseEnter={runAway}
              onFocus={runAway}
              onTouchStart={runAway}
            >
              {busy ? 'Checking…' : 'Unlock'}
              <Icon name="arrow" size={17} />
            </button>
          </div>

          <p className={`profile-lock__message${message ? ' profile-lock__message--visible' : ''}`} aria-live="polite">
            <span>•</span>{message}
          </p>
        </form>

        <button type="button" className="profile-lock__cancel" onClick={onCancel}>Back to profiles</button>
      </section>
    </div>
  )
}
