/* ---------- Stremio Addon Catalog Service ---------- */

import { fetchWithTimeout } from './ev0l'
import type {
  AddonManifest,
  Catalog,
  InstalledAddon,
  NormalizedMetaPreview,
  CatalogRequestOptions,
  CatalogResponse,
  AddonError,
} from './addonTypes'

/** Storage key for installed addons (JSON array) */
const STORAGE_KEY = 'ev0l-addons'

/** Default timeout for addon API requests (ms) — same pattern as ev0l.ts */
const DEFAULT_TIMEOUT = 15000

/** Fetch the addon manifest at the given URL and return parsed AddonManifest.
 *  CORS must be enabled on the addon host for browser consumption.
 *  Throws on network errors or invalid JSON. */
async function fetchAddonManifest(url: string): Promise<AddonManifest> {
  const res = await fetchWithTimeout(url, { credentials: 'omit' }, DEFAULT_TIMEOUT)
  if (!res.ok) {
    throw new Error(`Addon manifest fetch ${res.status}`)
  }
  const raw = await res.json()
  // Basic validation
  if (!raw.id || !raw.catalogs || !Array.isArray(raw.catalogs)) {
    throw new Error('Invalid addon manifest: missing id or catalogs')
  }
  return raw as AddonManifest
}

/** Persist the installed addon to localStorage.
 *  Merges with existing addons so reinstalling an addon updates its state. */
function saveInstalledAddon(addon: InstalledAddon): void {
  try {
    const existing = loadInstalledAddons()
    const index = existing.findIndex((a) => a.manifestId === addon.manifestId)
    const toSave: InstalledAddon = {
      ...addon,
      catalogExtras: addon.catalogExtras || {},
    }
    if (index >= 0) {
      existing[index] = toSave
    } else {
      existing.push(toSave)
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing))
  } catch {
    /* localStorage quota exceeded — silently fall back */ }
}

/** Load the installed addons array from localStorage. */
function loadInstalledAddons(): InstalledAddon[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

/** -------------------------------------------------------------------------
 *  Public API
 * ------------------------------------------------------------------------- */

/** Install a new addon by manifest URL.
 *  Fetches the manifest, parses it, and persists it to localStorage.
 *  Returns the InstalledAddon record, or throws if the manifest is invalid
 *  or the fetch fails. */
export async function installManifest(
  manifestUrl: string,
): Promise<InstalledAddon> {
  const manifest = await fetchAddonManifest(manifestUrl)
  const addon: InstalledAddon = {
    manifestId: manifest.id,
    version: manifest.version,
    name: manifest.name,
    logo: manifest.logo,
    enabled: true,
    catalogs: manifest.catalogs,
    manifestUrl,
    catalogExtras: {},
  }
  saveInstalledAddon(addon)
  return addon
}

/** Retrieve the currently installed addons from localStorage. */
export function getInstalledAddons(): InstalledAddon[] {
  return loadInstalledAddons()
}

/** Enable or disable an installed addon by its manifestId. */
export function setAddonEnabled(manifestId: string, enabled: boolean): void {
  const addons = loadInstalledAddons()
  const a = addons.find((x) => x.manifestId === manifestId)
  if (a) {
    a.enabled = enabled
    saveInstalledAddon(a as InstalledAddon)
  }
}

/** Get the extra parameter values for a specific catalog id.
 *  Returns the stored object, or an empty object if none set. */
export function getCatalogExtras(
  addon: InstalledAddon,
  catalogId: string,
): Record<string, unknown> {
  const addons = loadInstalledAddons()
  const found = addons.find((x) => x.manifestId === addon.manifestId)
  return (found?.catalogExtras?.[catalogId] as Record<string, unknown>) || {}
}

/** Set extra parameter values for a specific catalog id.
 *  This allows user configuration (e.g. search query, skip/limit paging). */
export function setCatalogExtras(
  addon: InstalledAddon,
  catalogId: string,
  extras: Record<string, unknown>,
): void {
  const addons = loadInstalledAddons()
  const a = addons.find((x) => x.manifestId === addon.manifestId)
  if (a) {
    a.catalogExtras = { ...a.catalogExtras, [catalogId]: extras }
    saveInstalledAddon(a as InstalledAddon)
  }
}

/** Fetch a catalog feed from an installed addon and return normalized meta previews.
 *  - Constructs `/catalog/${type}/${id}.json` using the addon's base URL pattern.
 *  - Applies extra parameters (search, skip, limit) as query string.
 *  - Normalizes raw metas into EV0L-compatible NormalizedMetaPreview objects.
 *  - Caches the result in memory (this call stack only; persistence across calls
 *    requires a separate memoization layer if desired). */
export async function getCatalog(
  addon: InstalledAddon,
  catalog: Catalog,
  options?: CatalogRequestOptions,
): Promise<CatalogResponse> {
  const base = addon.manifestUrl.replace('/manifest.json', '')
  const type = catalog.type
  const id = catalog.id

  // Build query string from extra properties
  const params = new URLSearchParams()
  if (options?.extra) {
    for (const [key, value] of Object.entries(options.extra)) {
      if (value !== undefined && value !== null) {
        params.append(key, String(value))
      }
    }
  }
  if (options?.skip !== undefined) params.append('skip', String(options.skip))
  if (options?.limit !== undefined) params.append('limit', String(options.limit))

  const query = params.toString() ? `?${params.toString()}` : ''
  const catalogUrl = `${base}/catalog/${type}/${id}${query}.json`

  try {
    const res = await fetchWithTimeout(catalogUrl, { credentials: 'omit' }, DEFAULT_TIMEOUT)
    if (!res.ok) {
      // Non-fatal: if the catalog endpoint returns 404/not-found, return empty
      if (res.status === 404) {
        return { metas: [], raw: [] }
      }
      throw new Error(`Catalog fetch ${res.status}`)
    }
    const raw = (await res.json()) as {
      metas: Array<{
        id: string
        type: string
        name: string
        poster: string
        year?: number
        genres?: string[]
        description?: string
      }>
    }

    // Normalize each raw meta into EV0L-compatible shape
    const metas = raw.metas.map((m) => ({
      id: m.id,
      type: m.type as 'movie' | 'series',
      name: m.name,
      poster: m.poster,
      year: m.year,
      genres: m.genres,
      description: m.description,
      source: 'stremio-addon' as const,
      addonId: addon.manifestId,
      addonCatalogId: catalog.id,
      extra: options?.extra || {},
    }))

    return { metas, raw: raw.metas }
  } catch (e) {
    const error: AddonError = {
      type: 'FETCH_ERROR',
      message: e instanceof Error ? e.message : 'Unknown fetch error',
      addonId: addon.manifestId,
    }
    throw error
  }
}

/** Fetch metadata for a single item from an addon.
 *  Constructs `/meta/${type}/${id}.json` and normalizes the result.
 *  Currently not required for the core catalog flow, but provided for completeness. */
export async function getMeta(
  addon: InstalledAddon,
  type: 'movie' | 'series',
  id: string,
): Promise<NormalizedMetaPreview> {
  const base = addon.manifestUrl.replace('/manifest.json', '')
  const metaUrl = `${base}/meta/${type}/${id}.json`

  try {
    const res = await fetchWithTimeout(metaUrl, { credentials: 'omit' }, DEFAULT_TIMEOUT)
    if (!res.ok) {
      throw new Error(`Meta fetch ${res.status}`)
    }
    const raw = (await res.json()) as {
      id: string
      type: string
      name: string
      poster: string
      year?: number
      genres?: string[]
      description?: string
    }

    return {
      id: raw.id,
      type: raw.type as 'movie' | 'series',
      name: raw.name,
      poster: raw.poster,
      year: raw.year,
      genres: raw.genres,
      description: raw.description,
      source: 'stremio-addon' as const,
      addonId: addon.manifestId,
      addonCatalogId: id,
      extra: {},
    }
  } catch (e) {
    const err = e as Error
    throw new Error(`Addon meta fetch failed: ${err.message}`)
  }
}

/** Initialize installed addons from localStorage on app start.
 *  Should be called once during app bootstrap (e.g. in main.tsx or a useEffect). */
export function initAddonsFromStorage(): InstalledAddon[] {
  return loadInstalledAddons()
}

/** Re-exported normalization functions for use by the UI layer. */
export {
  normalizeStremioMeta,
  normalizeCinemetaMeta,
  mergeMetas,
} from './normalizeMeta'