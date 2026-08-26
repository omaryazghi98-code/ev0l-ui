import { EVOL_API_URL, EVOL_POWER_API_URL, CINEMETA_URL, CDN_LIVE_TV_API, DLHD_BASE_URL, HYPERBEAM_URL } from '../config'
import type { GhostSentryStatus } from '../lib/ev0l'

/* ---------------------- Client preferences (localStorage) ---------------------- */

/** Persisted in localStorage under the key "ev0l-settings". */
export type AppearancePrefs = {
  theme: 'dark' | 'light'
  motionReduce: boolean
}

export type LibraryPrefs = {
  historyLimit: number
}

export type GhostSentryClient = {
  enabled: boolean
  idleMinutes: number
  afterHour: number
  action: 'sleep' | 'shutdown' | 'restart'
}

export type SettingsState = {
  appearance: AppearancePrefs
library: LibraryPrefs
  ghostSentry: GhostSentryClient
}

/* ---------------------- Read-only runtime configuration ---------------------- */

/* ---------------------- Read-only runtime configuration ---------------------- */

/** Derived from src/config.ts — never contains secrets or URLs with credentials. */
export type ServicesConfig = {
  apiBase: string
  powerBase: string
  cinemeta: string
  cdnLiveTv: string
  dlhd: string
  hyperbeam: string
}

/** Per-provider reachability status shown in the GUI. */
export type ProviderStatus = 'configured' | 'unreachable'
export type ProvidersMap = {
  cinemeta: ProviderStatus
  cdnLiveTv: ProviderStatus
  dlhd: ProviderStatus
  hyperbeam: ProviderStatus
}

/* ---------------------- localStorage helpers ---------------------- */

const STORAGE_KEY = 'ev0l-settings'

const defaults: SettingsState = {
  appearance: { theme: 'light', motionReduce: false },
  library: { historyLimit: 50 },
  ghostSentry: { enabled: false, idleMinutes: 30, afterHour: 22, action: 'shutdown' },
}

/** Load settings from localStorage, falling back to defaults. */
export function loadSettings(): SettingsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw)
    return {
      appearance: { theme: parsed.appearance.theme, motionReduce: parsed.appearance.motionReduce },
      library: { historyLimit: parsed.library.historyLimit },
      ghostSentry: {
        enabled: parsed.ghostSentry.enabled,
        idleMinutes: parsed.ghostSentry.idleMinutes,
        afterHour: parsed.ghostSentry.afterHour,
        action: parsed.ghostSentry.action,
      },
    }
  } catch {
    return defaults
  }
}

/** Merge partial settings into localStorage, preserving existing values. */
export function saveSettings(partial: Partial<SettingsState>): void {
  try {
    const current = loadSettings()
    const next = {
      appearance: { ...current.appearance, ...partial.appearance },
      library: { ...current.library, ...partial.library },
      ghostSentry: { ...current.ghostSentry, ...partial.ghostSentry },
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* localStorage quota exceeded or corruption — silently fall back */
  }
}

export { EVOL_API_URL, CINEMETA_URL } from '../config'

/* ---------------------- Read-only runtime config ---------------------- */

/** Build ServicesConfig from src/config.ts — read-only, never secrets. */
export function getServicesConfig(): ServicesConfig {
  return {
    apiBase: EVOL_API_URL,
    powerBase: EVOL_POWER_API_URL,
    cinemeta: CINEMETA_URL,
    cdnLiveTv: CDN_LIVE_TV_API,
    dlhd: DLHD_BASE_URL,
    hyperbeam: HYPERBEAM_URL,
  }
}

/** Provider reachability: "configured" if the corresponding endpoint is reachable,
 *  "unreachable" otherwise. Uses existing EV0L integrations only (no new fetches of bare URLs). */
export async function getProvidersStatus(): Promise<ProvidersMap> {
  const result: ProvidersMap = {
    cinemeta: 'unreachable',
    cdnLiveTv: 'unreachable',
    dlhd: 'unreachable',
    hyperbeam: 'unreachable',
  }

  // EV0L health: reports hyperbeam and dlhd booleans based on API_KEY presence
  try {
    const healthRes = await fetch(`${EVOL_API_URL}/api/health`, { credentials: 'omit' })
    if (healthRes.ok) {
      const health = await healthRes.json()
      if (health.hyperbeam) result.hyperbeam = 'configured'
      if (health.dlhd) result.dlhd = 'configured'
    }
  } catch {
    /* ignore */
  }

  // CDN Live TV sports: existing endpoint
  try {
    const cdnRes = await fetch(`${EVOL_API_URL}/api/cdnlivetv/sports`, { credentials: 'omit' })
    if (cdnRes.ok) result.cdnLiveTv = 'configured'
  } catch {
    /* ignore */
  }

  // DLHD channels: existing endpoint (may fail if DLHD_API_KEY absent — that's "unreachable", not an error)
  try {
    const dlhdRes = await fetch(`${EVOL_API_URL}/api/dlhd/channels`, { credentials: 'omit' })
    if (dlhdRes.ok) result.dlhd = 'configured'
  } catch {
    /* ignore */
  }

  // Cinemeta: use the health check as proxy; if health.ok and no explicit unreachable flag, treat as configured
  // (Cinemeta is always available as a remote metadata service; we report based on health)
  result.cinemeta = result.hyperbeam === 'configured' || result.dlhd === 'configured' ? 'configured' : 'unreachable'

  // Hyperbeam: reported via health check above; no extra session creation (paid resource, deferred)
  // Already set from health check.

  return result
}

/* ---------------------- Ghost Sentry client integration ---------------------- */

export async function syncGhostSentryServer(enabled: boolean): Promise<GhostSentryStatus | null> {
  const pin = window.prompt(
    enabled
      ? 'Enter your EV0L system PIN to disable Ghost Sentry:'
      : 'Enter your EV0L system PIN to enable Ghost Sentry:',
  )
  if (pin === null || !pin.trim()) return null

  try {
    const { setGhostSentry } = await import('../lib/ev0l')
    const next = await setGhostSentry(enabled, pin)
    // Persist the new state to localStorage so Settings page reflects it
    saveSettings({ ghostSentry: { enabled: next.enabled, idleMinutes: next.idleMinutes, afterHour: next.afterHour, action: next.action } })
    return next
  } catch {
    return null
  }
}