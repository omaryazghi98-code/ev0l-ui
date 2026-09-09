import { useEffect, useRef, useState } from 'react'
import ProfileUnlockGate from './ProfileUnlockGate'
import { loadProfiles, setActiveProfileId, verifyProfilePin, type Profile } from '../lib/ev0l'

export default function ProfileGuardAgent() {
  const [lockedProfile, setLockedProfile] = useState<Profile | null>(null)
  const targetRef = useRef<HTMLButtonElement | null>(null)
  const allowNextClickRef = useRef(false)

  useEffect(() => {
    const onClickCapture = (event: MouseEvent) => {
      if (allowNextClickRef.current) {
        allowNextClickRef.current = false
        return
      }
      const target = event.target as HTMLElement | null
      const card = target?.closest<HTMLButtonElement>('.profile-screen .profile-card')
      if (!card) return
      const profile = loadProfiles().find((item) => item.id === 'omar')
      const cardName = card.querySelector('strong')?.textContent?.trim()
      if (!profile?.pinHash || cardName !== profile.name) return
      event.preventDefault()
      event.stopPropagation()
      targetRef.current = card
      setLockedProfile(profile)
    }
    document.addEventListener('click', onClickCapture, true)
    return () => document.removeEventListener('click', onClickCapture, true)
  }, [])

  if (!lockedProfile) return null

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
