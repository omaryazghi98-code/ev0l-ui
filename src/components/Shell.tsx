import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { EVOL_POWER_API_URL } from '../config'
import { applyTheme, getTheme, loadProfiles, setActiveProfileId, STORAGE, type Profile, type Theme, verifyProfilePin } from '../lib/ev0l'
import { Brand, Icon } from './UI'
import ProfileUnlockGate from './ProfileUnlockGate'
import ProfileCard from './ProfileCard'
import LiquidEther from './LiquidEther'
import '../styles/profile-picker.css'

const NAV = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/movies', label: 'Movies', icon: 'film' },
  { to: '/series', label: 'Series', icon: 'tv' },
  { to: '/iptv', label: 'Live TV', icon: 'live' },
  { to: '/sports', label: 'Sports', icon: 'live' },
  { to: '/streaming', label: 'Streaming', icon: 'play' },
  { to: '/my-list', label: 'My List', icon: 'bookmark' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
]

export function ProfilePicker({ onSelect }: { onSelect: (profile: Profile) => void }) {
  const [profiles, setProfiles] = useState(loadProfiles)
  const [lockedProfile, setLockedProfile] = useState<Profile | null>(null)

  function addGuest() {
    const count = profiles.filter((profile) => profile.id.startsWith('guest')).length + 1
    const profile = { id: `guest-${Date.now()}`, name: `Guest ${count}`, avatar: 'G' }
    const next = [...profiles, profile]
    localStorage.setItem(STORAGE.profiles, JSON.stringify(next))
    setProfiles(next)
  }

  function connect(profile: Profile) {
    if (profile.pinHash) {
      setLockedProfile(profile)
      return
    }
    onSelect(profile)
  }

  return (
    <main className="profile-screen">
      <div className="profile-screen__ether" aria-hidden="true">
        <LiquidEther
          colors={['#00F0FF', '#7C3CFF', '#19FF8C']}
          mouseForce={18}
          cursorSize={100}
          isViscous={false}
          resolution={0.45}
          isBounce={false}
          autoDemo={true}
          autoSpeed={0.35}
          autoIntensity={1.8}
          takeoverDuration={0.25}
          autoResumeDelay={3000}
          autoRampDuration={0.6}
        />
      </div>

      <div className="profile-screen__content">
        <div className="profile-ambient profile-ambient--one" />
        <div className="profile-ambient profile-ambient--two" />
        <header className="profile-top"><Brand /><span>Personal streaming, evolved.</span></header>

        <section className="profile-panel" aria-labelledby="profile-title">
          <span className="eyebrow">Choose your space</span>
          <h1 id="profile-title">Who's watching?</h1>
          <p>Your history, queue, and recommendations stay personal.</p>

          <div className="profile-grid profile-grid--cards">
            {profiles.map((profile, index) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                index={index}
                protected={Boolean(profile.pinHash)}
                onConnect={() => connect(profile)}
              />
            ))}

            <button className="profile-card profile-card--add" onClick={addGuest} type="button">
              <span className="profile-avatar"><Icon name="plus" size={32} /></span>
              <strong>Add guest</strong>
              <small>Create a new local profile</small>
            </button>
          </div>
        </section>

        <footer className="profile-footer"><span>EV0L</span><span>YOUR SCREEN. YOUR STORY.</span></footer>
      </div>

      {lockedProfile && (
        <ProfileUnlockGate
          profile={lockedProfile}
          onCancel={() => setLockedProfile(null)}
          onUnlock={async (pin) => {
            const accepted = await verifyProfilePin(lockedProfile, pin)
            if (accepted) onSelect(lockedProfile)
            return accepted
          }}
        />
      )}
    </main>
  )
}

export function AppShell({ profile, onSwitchProfile, children }: { profile: Profile; onSwitchProfile: () => void; children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getTheme)
  const [profileOpen, setProfileOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [systemPowerOpen, setSystemPowerOpen] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [inPowerFlight, setInPowerFlight] = useState(false)
  const navigate = useNavigate(); const location = useLocation()

  useEffect(() => { applyTheme(theme) }, [theme])
  useEffect(() => {
    const onOnline = () => setOnline(true); const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline)
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline) }
  }, [])
  useEffect(() => { setProfileOpen(false) }, [location.pathname])
  useEffect(() => {
    const shortcuts = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return
      if (event.key === '?') { event.preventDefault(); setHelpOpen(true) }
      if (event.key === 'Escape') { setHelpOpen(false); setProfileOpen(false) }
      if (event.key.toLowerCase() === 'h') navigate('/')
      if (event.key.toLowerCase() === 's') navigate('/search')
      if (event.key.toLowerCase() === 'm') navigate('/my-list')
    }
    window.addEventListener('keydown', shortcuts)
    return () => window.removeEventListener('keydown', shortcuts)
  }, [navigate])

  return <div className="app-shell">
    {!online && <div className="offline-banner"><Icon name="info"/>You're offline. Cached EV0L screens remain available; video playback requires a connection.</div>}
    <header className="site-header"><Brand compact/><nav className="desktop-nav" aria-label="Primary navigation">{NAV.map((item) => <NavLink key={item.to} to={item.to} end={item.to === '/'}>{item.label}</NavLink>)}</nav>
      <div className="header-actions"><Link className="icon-button search-button" to="/search" aria-label="Search"><Icon name="search"/></Link><button className="icon-button theme-button" aria-label={`Use ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><Icon name={theme === 'dark' ? 'sun' : 'moon'}/></button>
        <div className="profile-menu"><button className="profile-trigger" aria-expanded={profileOpen} onClick={() => setProfileOpen(!profileOpen)}><span>{profile.avatar || profile.name[0]}</span><b>{profile.name}</b><Icon name="arrow" size={15}/></button>{profileOpen && <div className="profile-popover"><div><span className="mini-avatar">{profile.avatar || profile.name[0]}</span><p><strong>{profile.name}</strong><small>Active profile</small></p></div><button onClick={onSwitchProfile}><Icon name="user"/>Switch profile</button><Link to="/status"><Icon name="info"/>System status</Link><Link to="/simkl"><Icon name="bookmark"/>Simkl</Link><button onClick={() => setSystemPowerOpen(true)}><Icon name="power"/>System power</button><button onClick={() => setHelpOpen(true)}><kbd>?</kbd>Keyboard shortcuts</button></div>}</div>
      </div>
    </header>
    <div className="app-content">{children}</div>
    <nav className="mobile-nav" aria-label="Mobile navigation">{NAV.map((item) => <NavLink key={item.to} to={item.to} end={item.to === '/'}><Icon name={item.icon}/><span>{item.label.replace('Live TV', 'Live')}</span></NavLink>)}</nav>
    {systemPowerOpen && <div className="dialog-backdrop" role="presentation" onMouseDown={() => setSystemPowerOpen(false)}>
  <section className="shortcut-dialog system-power-dialog" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
    <header><div><span className="eyebrow">Lenovo system</span><h2>Power</h2></div><button className="icon-button" onClick={() => setSystemPowerOpen(false)} aria-label="Close"><Icon name="close"/></button></header>
    <div className="system-power-actions">
      <button className="system-power-action" onClick={() => { if (inPowerFlight) return; setInPowerFlight(true); try { const pin = window.prompt('Enter EV0L system PIN'); if (!pin) return; fetch(`${EVOL_POWER_API_URL}/api/system/power`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sleep', pin }) }) } finally { setInPowerFlight(false) } }}><Icon name="moon"/><span><strong>Sleep</strong><small>Put the Lenovo to sleep</small></span></button>
      <button className="system-power-action" onClick={() => { if (inPowerFlight) return; if (!window.confirm('Restart the Lenovo?')) return; setInPowerFlight(true); try { const pin = window.prompt('Enter EV0L system PIN'); if (!pin) return; fetch(`${EVOL_POWER_API_URL}/api/system/power`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'restart', pin }) } ) } finally { setInPowerFlight(false) } }}><Icon name="refresh"/><span><strong>Restart</strong><small>Restart the Lenovo</small></span></button>
      <button className="system-power-action system-power-action--danger" onClick={() => { if (inPowerFlight) return; if (!window.confirm('Shut down the Lenovo?')) return; setInPowerFlight(true); try { const pin = window.prompt('Enter EV0L system PIN'); if (!pin) return; fetch(`${EVOL_POWER_API_URL}/api/system/power`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'shutdown', pin }) }) } finally { setInPowerFlight(false) } }}><Icon name="power"/><span><strong>Shut down</strong><small>Turn off the Lenovo</small></span></button>
    </div>
  </section>
</div>}
{helpOpen && <div className="dialog-backdrop" role="presentation" onMouseDown={() => setHelpOpen(false)}><section className="shortcut-dialog" role="dialog" aria-modal="true" aria-labelledby="shortcut-title" onMouseDown={(e) => e.stopPropagation()}><header><div><span className="eyebrow">Navigate faster</span><h2 id="shortcut-title">Keyboard shortcuts</h2></div><button className="icon-button" onClick={() => setHelpOpen(false)} aria-label="Close"><Icon name="close"/></button></header><div className="shortcut-list"><span><kbd>H</kbd>Home</span><span><kbd>S</kbd>Search</span><span><kbd>M</kbd>My List</span><span><kbd>?</kbd>Open this help</span><span><kbd>Esc</kbd>Close overlays</span></div></section></div>}
  </div>
}

export function RootShell({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(() => {
    const id = localStorage.getItem(STORAGE.activeProfile)
    return id ? loadProfiles().find((item) => item.id === id) || null : null
  })
  function select(next: Profile) { setActiveProfileId(next.id); setProfile(next) }
  if (!profile) return <ProfilePicker onSelect={select}/>
  return <AppShell profile={profile} onSwitchProfile={() => { localStorage.removeItem(STORAGE.activeProfile); setProfile(null) }}>{children}</AppShell>
}
