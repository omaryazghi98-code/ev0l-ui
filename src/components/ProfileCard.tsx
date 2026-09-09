import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import type { Profile } from '../lib/ev0l'
import './ProfileCard.css'

type Props = {
  profile: Profile
  index?: number
  protected?: boolean
  onConnect: () => void
}

function isImageAvatar(avatar?: string) {
  return Boolean(avatar?.startsWith('data:image/'))
}

export default function ProfileCard({ profile, index = 0, protected: isProtected = false, onConnect }: Props) {
  const shellRef = useRef<HTMLElement>(null)
  const rafRef = useRef<number | null>(null)
  const unlockTimerRef = useRef<number | null>(null)
  const target = useRef({ x: 50, y: 50 })
  const current = useRef({ x: 50, y: 50 })
  const [active, setActive] = useState(false)
  const [flipped, setFlipped] = useState(false)

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (unlockTimerRef.current) window.clearTimeout(unlockTimerRef.current)
    }
  }, [])

  function animate() {
    if (rafRef.current) return
    const step = () => {
      const shell = shellRef.current
      if (!shell) return
      current.current.x += (target.current.x - current.current.x) * 0.14
      current.current.y += (target.current.y - current.current.y) * 0.14
      shell.style.setProperty('--pointer-x', `${current.current.x}%`)
      shell.style.setProperty('--pointer-y', `${current.current.y}%`)
      shell.style.setProperty('--rotate-x', `${(50 - current.current.y) / 5}deg`)
      shell.style.setProperty('--rotate-y', `${(current.current.x - 50) / 6}deg`)
      const settled = Math.abs(target.current.x - current.current.x) < 0.05 && Math.abs(target.current.y - current.current.y) < 0.05
      if (!settled || active) rafRef.current = requestAnimationFrame(step)
      else rafRef.current = null
    }
    rafRef.current = requestAnimationFrame(step)
  }

  function move(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerType === 'touch' || flipped) return
    const rect = event.currentTarget.getBoundingClientRect()
    target.current = {
      x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)),
    }
    animate()
  }

  function enter(event: ReactPointerEvent<HTMLElement>) {
    setActive(true)
    move(event)
  }

  function leave() {
    setActive(false)
    target.current = { x: 50, y: 50 }
    animate()
  }

  function connect() {
    if (!isProtected || flipped) {
      onConnect()
      return
    }

    setActive(false)
    setFlipped(true)
    if (unlockTimerRef.current) window.clearTimeout(unlockTimerRef.current)
    unlockTimerRef.current = window.setTimeout(() => {
      onConnect()
    }, 760)
  }

  function activateFromCard(event: MouseEvent<HTMLElement>) {
    if (!isProtected || flipped) return
    if ((event.target as HTMLElement).closest('button')) return
    connect()
  }

  function activateFromKeyboard(event: KeyboardEvent<HTMLElement>) {
    if (!isProtected || flipped || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    connect()
  }

  const imageAvatar = isImageAvatar(profile.avatar)

  return (
    <article
      ref={shellRef}
      className={`ev-profile-card ev-profile-card--${index % 4}${active ? ' is-active' : ''}${isProtected ? ' is-protected' : ''}${flipped ? ' is-flipped' : ''}`}
      onPointerEnter={enter}
      onPointerMove={move}
      onPointerLeave={leave}
      onClick={activateFromCard}
      onKeyDown={activateFromKeyboard}
      tabIndex={isProtected ? 0 : undefined}
      aria-label={isProtected ? `Open ${profile.name} owner login` : `Enter ${profile.name} profile`}
    >
      <div className="ev-profile-card__glow" />
      <div className="ev-profile-card__scene">
        <div className="ev-profile-card__surface ev-profile-card__surface--front">
          <div className="ev-profile-card__shine" />
          <div className="ev-profile-card__glare" />
          <div className="ev-profile-card__content">
            <div className={`ev-profile-card__avatar${imageAvatar ? ' has-image' : ''}`} aria-hidden="true">
              {imageAvatar ? <img src={profile.avatar} alt="" /> : <span>{profile.avatar || profile.name[0]}</span>}
            </div>
            <div className="ev-profile-card__copy">
              <span className="eyebrow">{isProtected ? 'Protected profile' : 'Private session'}</span>
              <h3>{profile.name}</h3>
              <p>{isProtected ? 'Owner space' : 'Local guest'}</p>
            </div>
            <div className="ev-profile-card__footer">
              <div>
                <strong>{isProtected ? '@omar' : '@guest'}</strong>
                <span>{isProtected ? 'PIN secured' : 'Ready'}</span>
              </div>
              <button type="button" className="ev-profile-card__connect" onClick={connect}>
                <span>{isProtected ? 'Connect' : 'Enter'}</span>
                <b aria-hidden="true">→</b>
              </button>
            </div>
          </div>
        </div>

        {isProtected && (
          <div className="ev-profile-card__surface ev-profile-card__surface--back" aria-hidden={!flipped}>
            <div className="ev-profile-card__back-grid" />
            <div className="ev-profile-card__back-copy">
              <span className="eyebrow">Owner channel</span>
              <div className="ev-profile-card__back-mark">O</div>
              <strong>IDENTITY CHECK</strong>
              <p>Private space detected.<br />Awaiting owner authentication.</p>
              <span className="ev-profile-card__scan"><i />SECURE HANDSHAKE</span>
            </div>
          </div>
        )}
      </div>
    </article>
  )
}
