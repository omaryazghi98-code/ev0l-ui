import { getHistory, getMeta, getWatchlist, addToWatchlist, saveProgress } from './ev0l'
import type { LibraryItem, MediaType, Meta } from './ev0l'

const SIMKL_API = 'https://api.simkl.com'
const SIMKL_AUTHORIZE = 'https://simkl.com/oauth/authorize'
const STORAGE_KEY = 'ev0l-simkl-auth'
const PKCE_VERIFIER_KEY = 'ev0l-simkl-pkce-verifier'
const PKCE_STATE_KEY = 'ev0l-simkl-oauth-state'
const LAST_SYNC_KEY = 'ev0l-simkl-last-sync'

export type SimklIds = {
  simkl?: number
  imdb?: string
  tmdb?: number
}

export type SimklUser = {
  name?: string
  avatar?: string
  account?: string
}

export type SimklAuth = {
  accessToken: string
  user: SimklUser | null
}

export type SimklStatus = 'not-configured' | 'disconnected' | 'connected'

export type SimklSyncResult = {
  pushedWatchlist: number
  pushedHistory: number
  importedWatchlist: number
  importedHistory: number
}

function clientId() {
  return import.meta.env.VITE_SIMKL_CLIENT_ID?.trim() || ''
}

function redirectUri() {
  return import.meta.env.VITE_SIMKL_REDIRECT_URI?.trim() || `${window.location.origin}/simkl/callback`
}

export function isSimklConfigured() {
  return Boolean(clientId())
}

export function loadSimklAuth(): SimklAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) as SimklAuth : null
  } catch {
    return null
  }
}

function saveSimklAuth(auth: SimklAuth | null) {
  if (!auth) localStorage.removeItem(STORAGE_KEY)
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(auth))
}

export function logoutSimkl() {
  saveSimklAuth(null)
  localStorage.removeItem(LAST_SYNC_KEY)
  localStorage.removeItem(PKCE_VERIFIER_KEY)
  localStorage.removeItem(PKCE_STATE_KEY)
}

function base64Url(bytes: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

async function sha256(value: string) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
}

function randomString(length = 64) {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
}

export async function beginSimklLogin() {
  const id = clientId()
  if (!id) throw new Error('Simkl client ID is not configured.')

  const verifier = randomString(32)
  const challenge = base64Url(await sha256(verifier))
  const state = randomString(16)

  localStorage.setItem(PKCE_VERIFIER_KEY, verifier)
  localStorage.setItem(PKCE_STATE_KEY, state)

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: id,
    redirect_uri: redirectUri(),
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })

  window.location.assign(`${SIMKL_AUTHORIZE}?${params.toString()}`)
}

async function json<T>(response: Response, label: string): Promise<T> {
  if (!response.ok) {
    let detail = ''
    try {
      const body = await response.json() as { message?: string; error?: string }
      detail = body.message || body.error || ''
    } catch { /* ignore malformed error body */ }
    throw new Error(`${label} failed (${response.status})${detail ? `: ${detail}` : ''}`)
  }
  return response.json() as Promise<T>
}

async function apiRequest<T>(path: string, init: RequestInit = {}) {
  const auth = loadSimklAuth()
  const id = clientId()
  if (!id) throw new Error('Simkl client ID is not configured.')
  if (!auth?.accessToken) throw new Error('Simkl is not connected.')

  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  headers.set('simkl-api-key', id)
  headers.set('Authorization', `Bearer ${auth.accessToken}`)

  try {
    return await json<T>(await fetch(`${SIMKL_API}${path}`, { ...init, headers }), 'Simkl request')
  } catch (error) {
    if (error instanceof Error && /\(401\)/.test(error.message)) {
      logoutSimkl()
    }
    throw error
  }
}

export async function finishSimklLogin(code: string, returnedState: string) {
  const id = clientId()
  const verifier = localStorage.getItem(PKCE_VERIFIER_KEY)
  const state = localStorage.getItem(PKCE_STATE_KEY)
  if (!id || !verifier) throw new Error('Simkl login state is missing.')
  if (!state || state !== returnedState) throw new Error('Simkl OAuth state mismatch.')

  const response = await fetch(`${SIMKL_API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      client_id: id,
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  })

  const token = await json<{ access_token: string }>(response, 'Simkl token exchange')
  saveSimklAuth({ accessToken: token.access_token, user: null })
  localStorage.removeItem(PKCE_VERIFIER_KEY)
  localStorage.removeItem(PKCE_STATE_KEY)

  const user = await getSimklUser()
  saveSimklAuth({ accessToken: token.access_token, user })
  return user
}

export async function getSimklUser() {
  return apiRequest<SimklUser>('/users/settings', { method: 'POST' })
}

export async function getSimklActivities() {
  return apiRequest<{ all?: string; movies?: string; shows?: string }>('/sync/activities')
}

export async function pushSimklWatchlist(items: LibraryItem[]) {
  const current = items
    .filter((item) => item.type === 'movie' || item.type === 'series')
    .slice(0, 100)

  let pushed = 0
  for (const item of current) {
    try {
      const type = item.type === 'movie' ? 'movies' : 'shows'
      const ids: SimklIds = { imdb: item.mediaId }
      await apiRequest(`/sync/add-to-list`, {
        method: 'POST',
        body: JSON.stringify({
          movies: type === 'movies' ? [{ ids, title: item.name }] : undefined,
          shows: type === 'shows' ? [{ ids, title: item.name }] : undefined,
          to: 'plantowatch',
        }),
      })
      pushed += 1
    } catch (error) {
      console.warn('Simkl watchlist sync failed:', item.mediaId, error)
    }
  }
  return pushed
}

export async function pushSimklHistory(items: LibraryItem[]) {
  let pushed = 0
  for (const item of items.filter((entry) => entry.position > 0 && entry.duration > 0)) {
    const progress = item.duration > 0 ? item.position / item.duration : 0
    if (progress < 0.15) continue

    try {
      if (item.type === 'movie') {
        await apiRequest('/sync/history', {
          method: 'POST',
          body: JSON.stringify({
            movies: [{ ids: { imdb: item.mediaId }, title: item.name, watched_at: item.watchedAt || item.updatedAt }],
          }),
        })
      } else {
        const showIds: SimklIds = { imdb: item.mediaId }
        await apiRequest('/sync/history', {
          method: 'POST',
          body: JSON.stringify({
            shows: [{
              ids: showIds,
              title: item.name,
              seasons: [{ number: item.season ?? 0, episodes: [{ number: item.episode ?? 0, watched_at: item.watchedAt || item.updatedAt }] }],
            }],
          }),
        })
      }
      pushed += 1
    } catch (error) {
      console.warn('Simkl history sync failed:', item.mediaId, error)
    }
  }
  return pushed
}

export async function pullSimklWatchlist(lastSync?: string | null) {
  const activities = await getSimklActivities()
  if (lastSync && activities.all === lastSync) return { imported: 0, activity: activities.all || lastSync }

  const items = await apiRequest<{
    movies?: Array<{ movie?: { ids?: SimklIds; title?: string; year?: number } }>
    shows?: Array<{ show?: { ids?: SimklIds; title?: string; year?: number } }>
  }>(`/sync/all-items${lastSync ? `?date_from=${encodeURIComponent(lastSync)}&extended=full` : '?extended=full'}`)

  let imported = 0
  for (const bucket of [items.movies || [], items.shows || []]) {
    for (const entry of bucket) {
      const ref = 'movie' in entry ? entry.movie : entry.show
      const imdb = ref?.ids?.imdb
      if (!imdb) continue
      try {
        const meta = await getMeta(ref === entry.movie ? 'movie' : 'series', imdb)
        await addToWatchlist(meta)
        imported += 1
      } catch (error) {
        console.warn('Simkl watchlist import failed:', imdb, error)
      }
    }
  }

  return { imported, activity: activities.all || new Date().toISOString() }
}

export async function pullSimklHistory(lastSync?: string | null) {
  const activities = await getSimklActivities()
  if (lastSync && activities.all === lastSync) return { imported: 0, activity: activities.all || lastSync }

  const items = await apiRequest<{
    movies?: Array<{ movie?: { ids?: SimklIds; title?: string }; watched_at?: string }>
    shows?: Array<{ show?: { ids?: SimklIds; title?: string; seasons?: Array<{ number?: number; episodes?: Array<{ number?: number; watched_at?: string }> }> } }>
  }>(`/sync/all-items${lastSync ? `?date_from=${encodeURIComponent(lastSync)}&extended=full` : '?extended=full'}`)

  let imported = 0
  for (const entry of items.movies || []) {
    const imdb = entry.movie?.ids?.imdb
    if (!imdb) continue
    try {
      const meta = await getMeta('movie', imdb)
      await saveProgress({
        type: 'movie', mediaId: meta.id, name: meta.name, poster: meta.poster || '',
        position: meta.runtime ? Number.parseInt(meta.runtime, 10) * 60 : 1,
        duration: meta.runtime ? Number.parseInt(meta.runtime, 10) * 60 : 1,
        watchedAt: entry.watched_at,
      })
      imported += 1
    } catch (error) {
      console.warn('Simkl movie history import failed:', imdb, error)
    }
  }

  for (const entry of items.shows || []) {
    const show = entry.show
    const imdb = show?.ids?.imdb
    if (!imdb) continue
    try {
      const meta = await getMeta('series', imdb)
      for (const season of show?.seasons || []) {
        for (const episode of season.episodes || []) {
          if (!season.number || !episode.number) continue
          const video = meta.videos?.find((item) => item.season === season.number && item.episode === episode.number)
          await saveProgress({
            type: 'series', mediaId: meta.id, name: meta.name, poster: meta.poster || '',
            season: season.number, episode: episode.number,
            position: video?.released ? 1 : 1, duration: 1, watchedAt: episode.watched_at,
          })
          imported += 1
        }
      }
    } catch (error) {
      console.warn('Simkl show history import failed:', imdb, error)
    }
  }

  return { imported, activity: activities.all || new Date().toISOString() }
}

export async function syncSimkl(): Promise<SimklSyncResult> {
  const [watchlist, history] = await Promise.all([getWatchlist(), getHistory()])
  const lastSync = localStorage.getItem(LAST_SYNC_KEY)
  const pushedWatchlist = await pushSimklWatchlist(watchlist)
  const pushedHistory = await pushSimklHistory(history)
  const importedWatchlistResult = await pullSimklWatchlist(lastSync)
  const importedHistoryResult = await pullSimklHistory(lastSync)
  const activity = importedHistoryResult.activity || importedWatchlistResult.activity
  if (activity) localStorage.setItem(LAST_SYNC_KEY, activity)

  return {
    pushedWatchlist,
    pushedHistory,
    importedWatchlist: importedWatchlistResult.imported,
    importedHistory: importedHistoryResult.imported,
  }
}

export function getSimklStatus(): SimklStatus {
  if (!isSimklConfigured()) return 'not-configured'
  return loadSimklAuth() ? 'connected' : 'disconnected'
}

export function simklStatusLabel(status: SimklStatus) {
  return status === 'connected' ? 'Connected' : status === 'not-configured' ? 'Not configured' : 'Not connected'
}
