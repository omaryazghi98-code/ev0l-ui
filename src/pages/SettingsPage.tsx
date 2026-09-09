// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EVOL_API_URL, CINEMETA_URL } from '../config'
import {
  loadSettings, saveSettings, getServicesConfig, getProvidersStatus,
} from '../lib/settings'
import { syncGhostSentryServer } from '../lib/settings'
import {
  installManifest, getInstalledAddons, setAddonEnabled,
  getCatalog, normalizeStremioMeta, mergeMetas,
  normalizeCinemetaMeta, mergeMetas as mergeMetasFn,
} from '../lib/addonCatalogs'
import type { NormalizedMetaPreview } from '../lib/normalizeMeta'
import { Icon } from '../components/UI'
import ProfilePhotoSettings from '../components/ProfilePhotoSettings'
import EvolQrConnect from '../components/EvolQrConnect'
import { loadProfiles, STORAGE, type Profile } from '../lib/ev0l'

type SettingsTab = 'services' | 'providers' | 'ghost-sentry' | 'library' | 'appearance' | 'addons' | 'connect'

function TabButton({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      className={selected ? 'settings-tab active' : 'settings-tab'}
      onClick={onClick}
      aria-selected={selected}
    >
      {label}
    </button>
  )
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<SettingsTab>('services')
  const [settings, setSettings] = useState(loadSettings())
  const { config: servicesConfig } = useServicesConfig()
  const [providers, setProviders] = useState(['loading', 'loading', 'loading', 'loading'])
  const [ghostSentry, setGhostSentryState] = useState(null)
  const [ghostSentryBusy, setGhostSentryBusy] = useState(false)
  const [ghostSentryError, setGhostSentryError] = useState('')
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(() => {
    const id = localStorage.getItem(STORAGE.activeProfile)
    return id ? loadProfiles().find((item) => item.id === id) || null : null
  })

  // --- Add-ons state ---
  const [addonUrl, setAddonUrl] = useState('')
  const addonUrlRef = useRef<HTMLInputElement>(null)
  const [addonBusy, setAddonBusy] = useState(false)
  const [addonError, setAddonError] = useState('')

  async function addAddonByUrl() {
    const url = (addonUrlRef.current as HTMLInputElement).value.trim()
    if (!url) return
    setAddonBusy(true)
    setAddonError('')
    try {
      const addon = await installManifest(url)
      const raw = getInstalledAddons()
      const normalized: NormalizedMetaPreview[] = []
      for (const a of raw) {
        for (const catalog of a.catalogs) {
          normalized.push({
            id: `stremio-addon:${a.manifestId}:${catalog.id}`,
            type: catalog.type as 'movie' | 'series',
            name: catalog.name,
            poster: a.logo,
            source: 'stremio-addon' as const,
            addonId: a.manifestId,
            addonCatalogId: catalog.id,
            extra: {},
          })
        }
      }
      setInstalledAddons(normalized)
      setAddonUrl('')
    } catch (e) {
      setAddonError('Unable to install add-on. Check the manifest URL and try again.')
      console.error(e)
    } finally {
      setAddonBusy(false)
    }
  }

  const [installedAddons, setInstalledAddons] = useState<NormalizedMetaPreview[]>([])
  useEffect(() => {
    const rawAddons = getInstalledAddons()
    const normalized: NormalizedMetaPreview[] = []
    for (const addon of rawAddons) {
      for (const catalog of addon.catalogs) {
        normalized.push({
          id: `stremio-addon:${addon.manifestId}:${catalog.id}`,
          type: catalog.type as 'movie' | 'series',
          name: catalog.name,
          poster: addon.logo,
          source: 'stremio-addon' as const,
          addonId: addon.manifestId,
          addonCatalogId: catalog.id,
          extra: {},
        })
      }
    }
    setInstalledAddons(normalized)
  }, [])

  useEffect(() => {
    void updateProvidersStatus()
  }, [])

  async function updateProvidersStatus() {
    const status = await getProvidersStatus()
    setProviders([status.cinemeta, status.cdnLiveTv, status.dlhd, status.hyperbeam])
  }

  function useServicesConfig() {
    const config = getServicesConfig()
    return { config }
  }

  const [appearance, setAppearance] = useState({ theme: 'light', motionReduce: false })
  const [library, setLibrary] = useState({ historyLimit: 50 })
  const [motionReduce, setMotionReduce] = useState(false)

  useEffect(() => {
    saveSettings({ appearance })
  }, [appearance])

  useEffect(() => {
    setGhostSentryState(loadSettings().ghostSentry)
  }, [])

  function selectTab(t: SettingsTab) {
    setTab(t)
  }

  function handleThemeChange(e) {
    setAppearance({ theme: e.target.value, motionReduce: motionReduce })
  }
  function handleMotionReduceChange(e) {
    setAppearance({ theme: appearance.theme, motionReduce: e.target.checked })
    saveSettings({ appearance })
  }

  function handleHistoryLimitChange(e) {
    const value = Number(e.target.value)
    if (!isNaN(value) && value >= 0) {
      setLibrary({ historyLimit: value })
      saveSettings({ library: { historyLimit: value } })
    }
  }

  async function handleGhostSentryToggle() {
    if (ghostSentryBusy) return
    setGhostSentryBusy(true)
    setGhostSentryError('')
    try {
      await syncGhostSentryServer(!ghostSentry)
      void updateProvidersStatus()
    } catch (e) {
      setGhostSentryError('Could not update Ghost Sentry. Check your PIN and try again.')
    } finally {
      setGhostSentryBusy(false)
    }
  }

  async function updateGhostSentryStatus() {
    try {
      const { getGhostSentry } = await import('../lib/ev0l')
      const status = await getGhostSentry()
      setGhostSentryState(status)
    } catch {
      setGhostSentryError('Could not load Ghost Sentry status.')
    }
  }

  async function testCdnsports() {
    try {
      const res = await fetch(`${EVOL_API_URL}/api/cdnlivetv/sports`, { credentials: 'omit' })
      if (res.ok) {
        const data = await res.json()
        alert(`CDN Live TV: ${data.total} matches available`)
      } else alert('CDN Live TV: unable to reach service')
    } catch { alert('CDN Live TV: connection failed') }
  }

  async function testDlhd() {
    try {
      const res = await fetch(`${EVOL_API_URL}/api/dlhd/channels`, { credentials: 'omit' })
      if (res.ok) {
        const data = await res.json()
        alert(`DLHD: ${data.length} channels available`)
      } else alert('DLHD: unable to reach service')
    } catch { alert('DLHD: connection failed') }
  }

  async function testHyperbeam() {
    try {
      const healthRes = await fetch(`${EVOL_API_URL}/api/health`, { credentials: 'omit' })
      if (healthRes.ok) {
        const health = await healthRes.json()
        const status = health.hyperbeam ? 'configured' : 'not configured (no Hyperbeam API key)'
        alert(`Hyperbeam: ${status}`)
      } else alert('Hyperbeam: unable to reach health endpoint')
    } catch { alert('Hyperbeam: connection failed') }
  }

  function testCinemeta() {
    alert(`Cinemeta metadata service: ${CINEMETA_URL}`)
  }

  function renderServicesTab() {
    return (
      <section>
        <h2>EV0L Services</h2>
        <div className="settings-section">
          <div className="service-row" data-admin-only><span>API Base</span><input type="text" value={servicesConfig.apiBase} readOnly className="settings-input" /></div>
          <div className="service-row" data-admin-only><span>Power Server</span><input type="text" value={servicesConfig.powerBase} readOnly className="settings-input" /></div>
          <div className="service-row" data-admin-only><span>Cinemeta</span><input type="text" value={servicesConfig.cinemeta} readOnly className="settings-input" /><button className="button button--subtle" onClick={testCinemeta}>Info</button></div>
          <div className="service-row" data-admin-only><span>CDN Live TV</span><input type="text" value={servicesConfig.cdnLiveTv} readOnly className="settings-input" /><button className="button button--subtle" onClick={testCdnsports}>Test</button></div>
          <div className="service-row" data-admin-only><span>DLHD</span><input type="text" value={servicesConfig.dlhd} readOnly className="settings-input" /><button className="button button--subtle" onClick={testDlhd}>Test</button></div>
          <div className="service-row" data-admin-only><span>Hyperbeam</span><input type="text" value={servicesConfig.hyperbeam} readOnly className="settings-input" /><button className="button button--subtle" onClick={testHyperbeam}>Status</button><small>report based on /api/health</small></div>
        </div>
      </section>
    )
  }

  function renderProvidersTab() {
    const labels = ['Cinemeta', 'CDN Live TV', 'DLHD', 'Hyperbeam']
    return (
      <section>
        <h2>Providers</h2>
        <div className="settings-section">
          {providers.map((status, i) => (
            <div key={i} className="provider-row" data-admin-only><span>{labels[i]}</span><span className={status === 'configured' ? 'status-dot status-dot--online' : 'status-dot status-dot--offline'}>{status}</span></div>
          ))}
        </div>
      </section>
    )
  }

  function renderGhostSentryTab() {
    return (
      <section data-admin-only>
        <h2>Ghost Sentry</h2>
        <div className="settings-section">
          {ghostSentryBusy ? <p>Updating Ghost Sentry…</p> : ghostSentryError ? <p>{ghostSentryError}</p> : ghostSentry ? <div><small>{ghostSentry.enabled ? `ARMED • ${ghostSentry.idleMinutes} min idle • after ${String(ghostSentry.afterHour).padStart(2, '0')}:00` : 'DISABLED'}</small>{ghostSentry.enabled && <div style={{ marginTop: '12px' }}><small>Current idle: {ghostSentry.idleMinutes} min</small><small>Action: {ghostSentry.action}</small></div>}<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}><button className="button button--subtle" onClick={handleGhostSentryToggle} disabled={ghostSentryBusy}>Disable Ghost Sentry</button><select><option value="sleep">Sleep</option><option value="shutdown">Shut down</option><option value="restart">Restart</option></select></div></div> : <div><small>DISABLED</small><button className="button button--subtle" onClick={handleGhostSentryToggle}>{ghostSentryBusy ? 'Updating' : 'Enable Ghost Sentry'}</button></div>}
        </div>
      </section>
    )
  }

  function renderLibraryTab() {
    return (
      <section><h2>Library</h2><div className="settings-section"><div className="form-row"><label>History item limit</label><input type="number" value={library.historyLimit} min="1" max="200" onChange={handleHistoryLimitChange} className="settings-input"/><small>Maximum items in Continue Watching / My List history</small></div><button className="button button--subtle" onClick={() => { setLibrary({ historyLimit: 50 }); saveSettings({ library: { historyLimit: 50 } }) }}>Reset to defaults</button></div></section>
    )
  }

  function renderAppearanceTab() {
    return (
      <section><h2>Appearance</h2><div className="settings-section"><div className="form-row"><label>Theme</label><select value={appearance.theme} onChange={handleThemeChange} className="settings-input"><option value="light">Light</option><option value="dark">Dark</option></select></div><div className="form-row"><label>Reduce motion</label><input type="checkbox" checked={appearance.motionReduce} onChange={handleMotionReduceChange} className="settings-input"/><small>Reduce animation motion for accessibility</small></div></div></section>
    )
  }

  function renderAddonsTab() {
    return (
      <section><h2>Installed Add-ons</h2><div className="settings-section">{installedAddons.length === 0 ? <p>No add-ons installed. Add a manifest URL to discover catalogs.</p> : <div>{installedAddons.map((meta, i) => <div key={i} className="provider-row"><span>{meta.name}</span><span className={meta.source === 'stremio-addon' ? 'status-dot status-dot--online' : 'status-dot status-dot--offline'}>{meta.source}</span></div>)}</div>}<div style={{ marginTop: '16px' }}><h3>Add new add-on</h3><div className="form-row"><input type="text" placeholder="Manifest URL (e.g. https://example.com/manifest.json)" ref={addonUrlRef} className="settings-input"/><button className="button button--subtle" onClick={addAddonByUrl} disabled={addonBusy}>{addonBusy ? 'Adding…' : 'Add'}</button></div>{addonError && <p>{addonError}</p>}</div></div></section>
    )
  }

  function renderConnectTab() {
    return (
      <section>
        <h2>Connect devices</h2>
        <EvolQrConnect />
      </section>
    )
  }

  const tabs: Array<[SettingsTab, string]> = [['services', 'Services'], ['providers', 'Providers'], ['ghost-sentry', 'Ghost Sentry'], ['library', 'Library'], ['appearance', 'Appearance'], ['addons', 'Add-ons'], ['connect', 'Connect']]

  return (
    <main className="settings-page">
      <header className="page-heading"><div><span className="eyebrow">EV0L</span><h1>Settings</h1><p>Configure EV0L services, playback, library and appearance.</p></div><button className="button button--subtle" type="button" onClick={() => navigate(-1)}><Icon name="back" /> Back</button></header>
      {currentProfile && <ProfilePhotoSettings profile={currentProfile} onProfileUpdate={setCurrentProfile} />}
      <nav className="settings-tabs" aria-label="Settings sections">{tabs.map(([value, label]) => <TabButton key={value} label={label} selected={tab === value} onClick={() => selectTab(value)} />)}</nav>
      <div className="settings-content">{tab === 'services' && renderServicesTab()}{tab === 'providers' && renderProvidersTab()}{tab === 'ghost-sentry' && renderGhostSentryTab()}{tab === 'library' && renderLibraryTab()}{tab === 'appearance' && renderAppearanceTab()}{tab === 'addons' && renderAddonsTab()}{tab === 'connect' && renderConnectTab()}</div>
    </main>
  )
}
