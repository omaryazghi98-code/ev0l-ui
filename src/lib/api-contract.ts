/*
 * EV0L 0.7 Phase 2A API Contract Definitions
 * TYPE-DEFINITIONS ONLY — no runtime implementation.
 * Matches actual server.mjs (port 8090) and power-server.mjs (port 8091) handlers exactly.
 * Do not modify: server.mjs, power-server.mjs, data/library.json, .env.local, webapp/,
 * existing frontend components, existing ev0l.ts runtime behavior.
 * Do not implement /api/simkl/episode.
 * URL and provider URL types are defined in src/config.ts to avoid
 * 'window' references in tsc --noEmit context.
 */

/* This file contains TYPE DEFINITIONS only.
 * No runtime code is executed.
 * Import from ../config.ts for client URL configuration.
 */

/* ---------- Shared types ---------- */

export type Booleanish = true | false | 1 | 0 | 'true' | 'false'

export type ErrorCode =
  | 'NETWORK'
  | 'HTTP'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_IMPLEMENTED'
  | 'EXTERNAL_API'

/* ---------- EV0L Public API (port 8090) ---------- */

// Health
export type HealthResponse = {
  ok: boolean
  hyperbeam: boolean
  dlhd: boolean
}

// Library Watchlist
export type LibraryItem = {
  id: number
  type: 'movie' | 'series'
  mediaId: string
  name: string
  poster: string
  season?: number
  episode?: number
  position: number
  duration: number
  watchedAt?: string
  updatedAt?: string
}

export type LibraryWatchlistResponse = {
  items: LibraryItem[]
}

export type LibraryWatchlistItem = LibraryItem

export type AddWatchlistInput = {
  type: 'movie' | 'series'
  mediaId: string
  name: string
  poster?: string
}

export type AddWatchlistResponse = {
  item: LibraryItem
  alreadyExists?: boolean
} | {
  error: string
}

// Library History
export type LibraryHistoryResponse = {
  items: LibraryItem[]
}

export type SaveProgressInput = {
  type: 'movie' | 'series'
  mediaId: string
  name: string
  poster?: string
  season?: number
  episode?: number
  position?: number
  duration?: number
}

export type SaveProgressResponse = {
  item: LibraryItem
} | {
  error: string
}

// Guest Invites
export type GuestToken = {
  token: string
  expiresAt: number
  createdAt: number
  host: string
  guestUrl: string
}

export type GuestInviteResponse = GuestToken

export type GuestInvitesList = {
  invites: GuestToken[]
}

export type AddGuestInviteInput = {
  hours?: number // 1-168, default 24
}

export type AddGuestInviteResponse = GuestToken

export type GuestInvitesGetResponse = GuestInvitesList

export type RevokeGuestInviteInput = {
  token: string
}

export type RevokeGuestInviteResponse = {
  ok: boolean
}

export type ValidateGuestInviteInput = {
  token: string
}

export type ValidateGuestInviteResponse = {
  valid: boolean
  expiresAt: number
} | {
  valid: false
  error: string
}

// CDN Live TV Sports
export type CdnEvent = {
  id: string // gameID
  sport: string
  competition: string
  home: string
  away: string
  startTime: string
  status: 'live' | 'finished' | 'upcoming'
  channels: CdnChannel[]
}

export type CdnChannel = {
  id: string
  channel_name: string
  url: string
  image?: string
  viewers: number
}

export type CdnLiveTVSports = {
  provider: 'cdn-live-tv'
  total: number
  events: CdnEvent[]
}

export type CdnLiveTVMatch = {
  provider: 'cdn-live-tv'
  match: CdnEvent
  streams: Array<{
    id: string
    name: string
    type: 'iframe'
    url: string
    image: string
    viewers: number
  }>
}

// DLHD
export type DlhdChannel = {
  channel_name: string
  channel_id: string
  logo_url?: string
}

export type DlhdEvent = {
  time?: string
  event: string
  channels?: DlhdChannel[]
  channels2?: DlhdChannel[]
}

export type DlhdMatch = {
  home: string
  away: string
  streams: Array<{
    id: string
    name: string
    type: 'iframe'
    url: string
  }>
}

export type DlhdSchedule = unknown // shape depends on DLHD API response; typed as generic for Phase 2A

export type DlhdChannels = unknown // shape depends on DLHD API response; typed as generic for Phase 2A

// Hyperbeam
export type HyperbeamSession = {
  session_id: string
  embed_url: string
}

/* ---------- EV0L Power API (port 8091) ---------- */

// Ghost Sentry
export type GhostSentryStatus = {
  enabled: boolean
  idleMinutes: number
  afterHour: number
  action: 'sleep' | 'shutdown' | 'restart'
  idleSeconds: number
  idleMinutesCurrent: number
  lastActivity: number
  lastReason: string
  eligible: boolean
}

// Power Activity
export type ActivityResponse = { ok: boolean } & GhostSentryStatus

// Ghost Sentry Configuration
export type SetGhostSentryInput = {
  enabled?: boolean
  idleMinutes?: number // 1-1440
  afterHour?: number // 0-23
  action?: 'sleep' | 'shutdown' | 'restart'
  pin: string // must match EVOL_SYSTEM_PIN
}

export type SetGhostSentryResponse = {
  ok: true
} | {
  error: 'Invalid PIN' | 'idleMinutes must be between 1 and 1440' | 'action must be sleep, shutdown, or restart' | 'afterHour must be between 0 and 23'
}

// Power Control
export type PowerAction = 'sleep' | 'restart' | 'shutdown'

export type PowerActionInput = {
  action: PowerAction
  pin: string // must match EVOL_SYSTEM_PIN
}

export type PowerActionResponse = {
  ok: true
  action: PowerAction
} | {
  error: 'Invalid PIN' | 'Invalid action'
}

/* ---------- Error Model ---------- */

export type ApiError =
  | { code: 'NETWORK'; message: string }
  | { code: 'HTTP'; status: number; message: string }
  | { code: 'VALIDATION'; message: string }
  | { code: 'NOT_FOUND'; message: string }
  | { code: 'UNAUTHORIZED'; message: string }
  | { code: 'FORBIDDEN'; message: string }
  | { code: 'NOT_IMPLEMENTED'; message: string; endpoint: string }
  | { code: 'EXTERNAL_API'; provider: string; message: string }

/* ---------- End of api-contract.ts ---------- */

/*
 * This file contains TYPE DEFINITIONS only.
 * No runtime code is executed.
 * Import from ../config.ts for client URL configuration.
 */