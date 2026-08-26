/* ---------- Stremio Addon Catalog Types ---------- */

export interface ExtraProperty {
  name: string
  isRequired: boolean
  options?: string[]
  optionsLimit?: number
}

export interface Catalog {
  /** Unique identifier for this catalog within the addon */
  id: string
  /** Content type: "movie", "series", "channel", "tv" */
  type: 'movie' | 'series' | 'channel' | 'tv'
  /** Human-readable name */
  name: string
  /** Optional extra properties that define catalog capabilities */
  extra?: ExtraProperty[]
}

export interface AddonManifest {
  /** Addon identifier (reverse DNS style) */
  id: string
  /** Addon version string */
  version: string
  /** Addon human-readable name */
  name: string
  /** Addon description */
  description: string
  /** Addon logo URL */
  logo: string
  /** Required resources: "catalog", "meta", "stream", "subtitles" */
  resources: string[]
  /** Content types this addon provides: "movie", "series" */
  types: string[]
  /** List of content catalogs this addon provides */
  catalogs: Catalog[]
  /** Optional ID prefixes for filtering (e.g. ["tt"] for IMDB IDs) */
  idPrefixes?: string[]
  /** Optional behavior hints */
  behaviorHints?: {
    /** Addon is configurable via a settings UI */
    configurable: boolean
  }
}

/** A single installed addon with its parsed manifest and state */
export interface InstalledAddon {
  /** Manifest id (reverse DNS) */
  manifestId: string
  /** Manifest version */
  version: string
  /** Manifest name */
  name: string
  /** Manifest logo URL */
  logo: string
  /** Whether the addon is enabled */
  enabled: boolean
  /** Parsed catalog definitions */
  catalogs: Catalog[]
  /** The raw manifest URL (for reference/removal) */
  manifestUrl: string
  /** Per-catalog extra parameter values (user-configurable) */
  catalogExtras: Record<string, object>
}

/** Normalized meta preview that can be consumed by EV0L's existing UI */
export interface NormalizedMetaPreview {
  /** EV0L-internal media ID (mapped from addonCatalogId or sourceId) */
  id: string
  /** 'movie' | 'series' */
  type: 'movie' | 'series'
  /** Human-readable name */
  name: string
  /** Poster image URL */
  poster: string
  /** Release year */
  year?: number
  /** Genre labels (used as filters in Discover/Board) */
  genres?: string[]
  /** Short description/synopsis */
  description?: string
  /** Source tracking */
  source: 'cinemeta' | 'stremio-addon'
  /** Original addon manifest id (for click-through attribution) */
  addonId: string
  /** Original catalog id from the addon manifest */
  addonCatalogId: string
  /** Extra parameter values that were used when fetching this meta */
  extra: Record<string, unknown>
}

/** Parameters passed when requesting a catalog feed */
export interface CatalogRequestOptions {
  /** Extra property values (e.g. { search: 'game of thrones', skip: 10 } ) */
  extra?: Record<string, unknown>
  /** Pagination skip count */
  skip?: number
  /** Maximum number of items to return */
  limit?: number
}

/** Response from fetching a Stremio catalog endpoint */
export type CatalogResponse = {
  metas: NormalizedMetaPreview[]
  /** Raw meta objects from the addon before normalization (for debugging) */
  raw: Array<{
    id: string
    type: string
    name: string
    poster: string
    year?: number
    genres?: string[]
    description?: string
  }>
}

/** Error state for addon catalog operations */
export type AddonError =
  | { type: 'FETCH_ERROR'; message: string; addonId: string }
  | { type: 'MANIFEST_PARSE_ERROR'; message: string; addonId: string }
  | { type: 'CATALOG_EMPTY'; message: string; addonId: string }
  | { type: 'CATALOG_NOT_FOUND'; message: string; addonId: string; catalogId: string }