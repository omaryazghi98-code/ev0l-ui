import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ProfileUnlockGate from './ProfileUnlockGate'
import GuestAdminLock from './GuestAdminLock'
import { loadProfiles, setActiveProfileId, STORAGE, verifyProfilePin, type Profile } from '../lib/ev0l'

export default function ProfileGuardAgent() {
  const [lockedProfile, setLockedProfile] = useState<Profile | null>(null)
  const [guestLockOpen, setGuestLockOpen] = useState(false)
  const [guestLockInline, setGuestLockInline] = useState(false)
  const targetRef = useRef<HTMLButtonElement | null>(null)
  const allowNextClickRef = useRef(false)
  const location = useLocation()
  const navigate = useNavigate()

  const activeProfileId = localStorage.getItem(STORAGE.activeProfile)
  const activeProfile = loadProfiles().find((item) => item.id === activeProfileId)
  const isGuest = Boolean(activeProfile?.id.startsWith('guest'))

  useEffect(() => {
    const onClickCapture = (event: MouseEvent) => {
      if (allowNextClickRef.current) {
        allowNextClickRef.current = false
        return
      }

      const target = event.target as HTMLElement | null
      if (!target) return

      const card = target.closest<HTMLButtonElement>('.profile-screen .profile-card')
      if (card) {
        const profile = loadProfiles().find((item) => item.id === 'omar')
        const cardName = card.querySelector('strong')?.textContent?.trim()
        if (profile?.pinHash && cardName === profile.name) {
          event.preventDefault()
          event.stopPropagation()
          targetRef.current = card
          setLockedProfile(profile)
          return
        }
      }

      if (!isGuest) return

      const sensitive =
        target.closest<HTMLButtonElement>('[data-admin-only]') ||
        target.closest<HTMLAnchorElement>('[data-admin-only]')
      if (sensitive) {
        event.preventDefault()
        event.stopPropagation()
        setGuestLockInline(false)
        setGuestLockOpen(true)
        return
      }

      const systemPowerButton = Array.from(document.querySelectorAll<HTMLButtonElement>('.profile-popover button')).find(
        (button) => button.textContent?.trim() === 'System power',
      )
      if (systemPowerButton && (target === systemPowerButton || systemPowerButton.contains(target))) {
        event.preventDefault()
        event.stopPropagation()
        setGuestLockInline(false)
        setGuestLockOpen(true)
      }
    }

    document.addEventListener('click', onClickCapture, true)
    return () => document.removeEventListener('click', onClickCapture, true)
  }, [isGuest])

  useEffect(() => {
    if (!isGuest) {
      setGuestLockOpen(false)
      setGuestLockInline(false)
    }
  }, [isGuest])

  useEffect(() => {
    if (!guestLockOpen) return
    if (location.pathname !== '/settings') return
    setGuestLockInline(true)
  }, [guestLockOpen, location.pathname])

  if (lockedProfile) {
    return (
      <ProfileUnlockGate
        profile={lockedProfile}
        onCancel={() => {
          targetRef.current = null
          setLockedProfile(null)
        }}
        onUnlock={async (pin) => {
          const accepted = await verifyProfilePin(lockedProfile, pin)
          if (!accepted) return false
          setActiveProfileId(lockedProfile.id)
          const target = targetRef.current
          if (target) {
            allowNextClickRef.current = true
            requestAnimationFrame(() => target.click())
          }
          return true
        }}
      />
    )
  }

  if (guestLockOpen && isGuest && !guestLockInline) {
    return (
      <GuestAdminLock
        onBack={() => {
          setGuestLockOpen(false)
          if (location.pathname !== '/settings') navigate('/')
        }}
        onUnlock={() => {
          setGuestLockOpen(false)
          setGuestLockInline(false)
        }}
      />
    )
  }

  if (guestLockOpen && isGuest && guestLockInline) {
    return (
      <GuestAdminLock
        inline
        onBack={() => setGuestLockOpen(false)}
        onUnlock={() => setGuestLockOpen(false)}
      />
    )
  }

  return null
}
