// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

type SettingsTab = 'services' | 'providers' | 'ghost-sentry' | 'library' | 'appearance' | 'addons'

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

  // --- Add-ons state ---
  const [addonUrl, setAddonUrl] = useState('')
  const addonUrlRef = useRef<HTMLInputElement>(null)
  const [addonBusy, setAddonBusy] = useState(false)
  const [addonError, setAddonError] = useState('')

  // --- Add-add-on-by-URL handler ---
  async function addAddonByUrl() {
    const url = (addonUrlRef.current as HTMLInputElement).value.trim()
    if (!url) return
    setAddonBusy(true)
    setAddonError('')
    try {
      const addon = await installManifest(url)
      // Refresh the installed addons list
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
      // Clear the input
      setAddonUrl('')
    } catch (e) {
      setAddonError('Unable to install add-on. Check the manifest URL and try again.')
      console.error(e)
    } finally {
      setAddonBusy(false)
    }
  }

  // Load installed addons from localStorage on mount
  const [installedAddons, setInstalledAddons] = useState<NormalizedMetaPreview[]>([])
  useEffect(() => {
    const rawAddons = getInstalledAddons()
    // Normalize each installed addon's catalogs into MetaPreview shapes
    const normalized: NormalizedMetaPreview[] = []
    for (const addon of rawAddons) {
      for (const catalog of addon.catalogs) {
        // We don't have raw metas here yet, just store the addon reference
        // The metas will be fetched when the user navigates to the Add-ons tab
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

  // Initialize providers status on mount
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

  // ---- Appearance state ----
  const [appearance, setAppearance] = useState({ theme: 'light', motionReduce: false })
  const [library, setLibrary] = useState({ historyLimit: 50 })
  const [motionReduce, setMotionReduce] = useState(false)

  useEffect(() => {
    saveSettings({ appearance })
  }, [appearance])

  // ---- Ghost Sentry state ----
  useEffect(() => {
    // Initialize from current settings
    setGhostSentryState(loadSettings().ghostSentry)
  }, [])

  // ---- Tab switching ----
  function selectTab(t: SettingsTab) {
    setTab(t)
  }

  // ---- Appearance change handlers ----
  function handleThemeChange(e) {
    setAppearance({ theme: e.target.value, motionReduce: motionReduce })
  }
  function handleMotionReduceChange(e) {
    setAppearance({ theme: appearance.theme, motionReduce: e.target.checked })
    saveSettings({ appearance })
  }

  // ---- Library change handler ----
  function handleHistoryLimitChange(e) {
    const value = Number(e.target.value)
    if (!isNaN(value) && value >= 0) {
      setLibrary({ historyLimit: value })
      saveSettings({ library: { historyLimit: value } })
    }
  }

  // ---- Ghost Sentry toggle ----
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

  // ---- Connection test handlers ----
  async function testCdnsports() {
    try {
      const res = await fetch(`${EVOL_API_URL}/api/cdnlivetv/sports`, { credentials: 'omit' })
      if (res.ok) {
        const data = await res.json()
        alert(`CDN Live TV: ${data.total} matches available`)
      } else {
        alert('CDN Live TV: unable to reach service')
      }
    } catch {
      alert('CDN Live TV: connection failed')
    }
  }

  async function testDlhd() {
    try {
      const res = await fetch(`${EVOL_API_URL}/api/dlhd/channels`, { credentials: 'omit' })
      if (res.ok) {
        const data = await res.json()
        alert(`DLHD: ${data.length} channels available`)
      } else {
        alert('DLHD: unable to reach service')
      }
    } catch {
      alert('DLHD: connection failed')
    }
  }

  async function testHyperbeam() {
    try {
      const healthRes = await fetch(`${EVOL_API_URL}/api/health`, { credentials: 'omit' })
      if (healthRes.ok) {
        const health = await healthRes.json()
        const status = health.hyperbeam ? 'configured' : 'not configured (no Hyperbeam API key)'
        alert(`Hyperbeam: ${status}`)
      } else {
        alert('Hyperbeam: unable to reach health endpoint')
      }
    } catch {
      alert('Hyperbeam: connection failed')
    }
  }

  // Test Cinemeta - show info
  function testCinemeta() {
    alert(`Cinemeta metadata service: ${CINEMETA_URL}`)
  }

  // Render each tab
  function renderServicesTab() {
    return (
      <section>
        <h2>EV0L Services</h2>
        <div className="settings-section">
          <div className="service-row">
            <span>API Base</span>
            <input type="text" value={servicesConfig.apiBase} readOnly className="settings-input" />
          </div>
          <div className="service-row">
            <span>Power Server</span>
            <input type="text" value={servicesConfig.powerBase} readOnly className="settings-input" />
          </div>
          <div className="service-row">
            <span>Cinemeta</span>
            <input type="text" value={servicesConfig.cinemeta} readOnly className="settings-input" />
            <button className="button button--subtle" onClick={testCinemeta} style={{ marginLeft: '0.5rem' }}>
              Info
            </button>
          </div>
          <div className="service-row">
            <span>CDN Live TV</span>
            <input type="text" value={servicesConfig.cdnLiveTv} readOnly className="settings-input" />
            <button className="button button--subtle" onClick={testCdnsports} style={{ marginLeft: '0.5rem' }}>
              Test
            </button>
          </div>
          <div className="service-row">
            <span>DLHD</span>
            <input type="text" value={servicesConfig.dlhd} readOnly className="settings-input" />
            <button className="button button--subtle" onClick={testDlhd} style={{ marginLeft: '0.5rem' }}>
              Test
            </button>
          </div>
          <div className="service-row">
            <span>Hyperbeam</span>
            <input type="text" value={servicesConfig.hyperbeam} readOnly className="settings-input" />
            <button className="button button--subtle" onClick={testHyperbeam} style={{ marginLeft: '0.5rem' }}>
              Status
            </button>
            <small>report based on /api/health</small>
          </div>
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
            <div key={i} className="provider-row">
              <span>{labels[i]}</span>
              <span className={status === 'configured' ? 'status-dot status-dot--online' : 'status-dot status-dot--offline'}>
                {status}
              </span>
            </div>
          ))}
        </div>
      </section>
    )
  }

  function renderGhostSentryTab() {
    return (
      <section>
        <h2>Ghost Sentry</h2>
        <div className="settings-section">
          {ghostSentryBusy ? (
            <p>Updating Ghost Sentry…</p>
          ) : ghostSentryError ? (
            <p>{ghostSentryError}</p>
          ) : ghostSentry ? (
            <div>
              <small>
                {ghostSentry.enabled ? `ARMED • {ghostSentry.idleMinutes} min idle • after ${String(ghostSentry.afterHour).padStart(2, '0')}:00` : 'DISABLED'}
              </small>
              {ghostSentry.enabled && (
                <div style={{ marginTop: '12px' }}>
                  <small>Current idle: {ghostSentry.idleMinutesCurrent} min</small>
                  <small>Action: {ghostSentry.action}</small>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button className="button button--subtle" onClick={handleGhostSentryToggle} disabled={ghostSentryBusy}>
                  {ghostSentry ? 'Disable Ghost Sentry' : 'Enable Ghost Sentry'}
                </button>
                {ghostSentry && (
                  <select>
                    <option value="sleep">Sleep</option>
                    <option value="shutdown">Shut down</option>
                    <option value="restart">Restart</option>
                  </select>
                )}
              </div>
            </div>
          ) : (
            <div>
              <small>DISABLED</small>
              <button className="button button--subtle" onClick={handleGhostSentryToggle}>
                {ghostSentryBusy ? 'Updating' : 'Enable Ghost Sentry'}
              </button>
            </div>
          )}
        </div>
      </section>
    )
  }

  function renderLibraryTab() {
    return (
      <section>
        <h2>Library</h2>
        <div className="settings-section">
          <div className="form-row">
            <label>History item limit</label>
            <input type="number" value={library.historyLimit} min="1" max="200" onChange={handleHistoryLimitChange} className="settings-input" />
            <small>Maximum items in Continue Watching / My List history</small>
          </div>
          <button className="button button--subtle" onClick={() => { setLibrary({ historyLimit: 50 }); saveSettings({ library: { historyLimit: 50 } }) }}>
            Reset to defaults
          </button>
        </div>
      </section>
    )
  }

  function renderAppearanceTab() {
    return (
      <section>
        <h2>Appearance</h2>
        <div className="settings-section">
          <div className="form-row">
            <label>Theme</label>
            <select value={appearance.theme} onChange={handleThemeChange} className="settings-input">
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
          <div className="form-row">
            <label>Reduce motion</label>
            <input type="checkbox" checked={appearance.motionReduce} onChange={handleMotionReduceChange} className="settings-input" />
            <small>Reduce animation motion for accessibility</small>
          </div>
        </div>
      </section>
    )
  }

  function renderAddonsTab() {
    // Pre-normalized addons from localStorage
    const addonSummaries = installedAddons.map((meta) => ({
      id: meta.addonCatalogId,
      name: meta.name,
      source: meta.source,
    }))

    return (
      <section>
        <h2>Installed Add-ons</h2>
        <div className="settings-section">
          {installedAddons.length === 0 ? (
            <p>No add-ons installed. Add a manifest URL to discover catalogs.</p>
          ) : (
            <div>
              {installedAddons.map((meta, i) => (
                <div key={i} className="provider-row">
                  <span>{meta.name}</span>
                  <span className={meta.source === 'stremio-addon' ? 'status-dot status-dot--online' : 'status-dot status-dot--offline'}>
                    {meta.source}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: '16px' }}>
            <h3>Add new add-on</h3>
            <div className="form-row">
              <input
                type="text"
                placeholder="Manifest URL (e.g. https://example.com/manifest.json)"
                ref={addonUrlRef}
                className="settings-input"
              />
              <button className="button button--subtle" onClick={addAddonByUrl} disabled={addonBusy}>
                {addonBusy ? 'Adding…' : 'Add'}
              </button>
            </div>
            {addonError && <p>{addonError}</p>}
          </div>
        </div>
      </section>
    )
  }

  // Render tab content
  const tabContent = {
    services: renderServicesTab,
    providers: renderProvidersTab,
    'ghost-sentry': renderGhostSentryTab,
    library: renderLibraryTab,
    appearance: renderAppearanceTab,
    addons: renderAddonsTab,
  }[tab]

  return (
    <main className="page settings-page">
      <h2>EV0L Settings</h2>
      <nav>
        <button className="settings-tab {tab === 'services' ? 'active' : ''}" onClick={() => selectTab('services')}>Services</button>
        <button className="settings-tab {tab === 'providers' ? 'active' : ''}" onClick={() => selectTab('providers')}>Providers</button>
        <button className="settings-tab {tab === 'ghost-sentry' ? 'active' : ''}" onClick={() => selectTab('ghost-sentry')}>Ghost Sentry</button>
        <button className="settings-tab {tab === 'library' ? 'active' : ''}" onClick={() => selectTab('library')}>Library</button>
        <button className="settings-tab {tab === 'appearance' ? 'active' : ''}" onClick={() => selectTab('appearance')}>Appearance</button>
        <button className="settings-tab {tab === 'addons' ? 'active' : ''}" onClick={() => selectTab('addons')}>Add-ons</button>
      </nav>
      <div className="settings-main">{tabContent ? tabContent() : <p>Loading…</p>}</div>
    </main>
  )
}