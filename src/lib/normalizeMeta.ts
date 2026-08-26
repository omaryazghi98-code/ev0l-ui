/* ---------- Stremio Addon Meta Normalization ---------- */

import type {
  NormalizedMetaPreview,
  Catalog,
  InstalledAddon,
} from './addonTypes'

/** Generate a stable internal EV0L ID for a Stremio addon catalog item.
 *  Format: "stremio-addon:{manifestId}:{catalogId}"
 *  This preserves addon identity separately from EV0L's own media IDs,
 *  while giving us a usable identifier for the TitlePage flow. */
function stremioInternalId(manifestId: string, catalogId: string): string {
  return `stremio-addon:${manifestId}:${catalogId}`
}

/** Normalize a raw Stremio catalog meta object into EV0L's NormalizedMetaPreview.
 *  The raw meta comes from /catalog/:type/:id.json and has fields:
 *    id, type, name, poster, year, genres, description
 *  We map these into NormalizedMetaPreview while preserving source identity.
 *
 *  Important: The resulting `id` is an internal identifier (`stremio-addon:...`)
 *  that can be passed to TitlePage/:type/:id without breaking the existing flow.
 *  The original addonCatalogId is preserved in `addonCatalogId` for attribution. */
export function normalizeStremioMeta(
  raw: {
    id: string
    type: string
    name: string
    poster: string
    year?: number
    genres?: string[]
    description?: string
  },
  addon: InstalledAddon,
  catalog: Catalog,
): NormalizedMetaPreview {
  return {
    // Internal ID that combines addon identity - usable by TitlePage route
    id: stremioInternalId(addon.manifestId, catalog.id),
    type: raw.type as 'movie' | 'series',
    name: raw.name,
    poster: raw.poster,
    year: raw.year,
    genres: raw.genres,
    description: raw.description,
    source: 'stremio-addon' as const,
    addonId: addon.manifestId,
    addonCatalogId: catalog.id,
    extra: {},
  }
}

/** Optionally normalize a Cinemeta meta object for consistency with the
 *  same shape. Used when we want addon and Cinemeta items to appear identically
 *  in Home rows, MediaCard lists, etc.
 *
 *  For Cinemeta, the `id` is already an IMDB `tt` ID, which is EV0L's native format.
 *  We just wrap it with source='cinemeta'. */
export function normalizeCinemetaMeta(
  raw: {
    id: string
    type: 'movie' | 'series'
    name: string
    poster: string
    year?: number
    genres?: string[]
    description?: string
  },
): NormalizedMetaPreview {
  return {
    id: raw.id,
    type: raw.type,
    name: raw.name,
    poster: raw.poster,
    year: raw.year,
    genres: raw.genres,
    description: raw.description,
    source: 'cinemeta' as const,
    addonId: '',
    addonCatalogId: '',
    extra: {},
  }
}

/** Merge a list of normalized previews, de-duplicating by `id` while preferring
 *  Cinemeta source over addon source when the same internal ID appears twice.
 *  Returns the merged, deduped list. */
export function mergeMetas(
  cinemetas: NormalizedMetaPreview[],
  addons: NormalizedMetaPreview[],
): NormalizedMetaPreview[] {
  const byId = new Map<string, NormalizedMetaPreview>()

  // First add all Cinemeta entries (they take precedence over addon for same ID)
  for (const m of cinemetas) {
    byId.set(m.id, m)
  }

  // Then add addon entries only if ID not already set by Cinemeta
  for (const m of addons) {
    if (!byId.has(m.id)) {
      byId.set(m.id, m)
    }
  }

  return Array.from(byId.values())
}