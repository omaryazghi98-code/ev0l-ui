import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { Profile } from '../lib/ev0l'
import './ProfileCard.css'

type Props = {
  profile: Profile
  index?: number
  protected?: boolean
  onConnect: () => void
}

export default function ProfileCard({ profile, index = 0, protected: isProtected = false, onConnect }: Props) {
  const shellRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)
  const target = useRef({ x: 50, y: 50 })
  const current = useRef({ x: 50, y: 50 })
  const [active, setActive] = useState(false)

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
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

  function move(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'touch') return
    const rect = event.currentTarget.getBoundingClientRect()
    target.current = {
      x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)),
    }
    animate()
  }

  function enter(event: ReactPointerEvent<HTMLDivElement>) {
    setActive(true)
    move(event)
  }

  function leave() {
    setActive(false)
    target.current = { x: 50, y: 50 }
    animate()
  }

  return (
    <article
      ref={shellRef}
      className={`ev-profile-card ev-profile-card--${index % 4}${active ? ' is-active' : ''}${isProtected ? ' is-protected' : ''}`}
      onPointerEnter={enter}
      onPointerMove={move}
      onPointerLeave={leave}
    >
      <div className="ev-profile-card__glow" />
      <div className="ev-profile-card__surface">
        <div className="ev-profile-card__shine" />
        <div className="ev-profile-card__glare" />
        <div className="ev-profile-card__content">
          <div className="ev-profile-card__avatar" aria-hidden="true">
            <span>{profile.avatar || profile.name[0]}</span>
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
            <button type="button" className="ev-profile-card__connect" onClick={onConnect}>
              <span>{isProtected ? 'Connect' : 'Enter'}</span>
              <b aria-hidden="true">→</b>
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}
