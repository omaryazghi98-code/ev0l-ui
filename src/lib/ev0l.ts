export const CINEMETA = 'https://v3-cinemeta.strem.io'
import { EVOL_API_URL } from '../config'

export const API_BASE = EVOL_API_URL
export type MediaType = 'movie' | 'series'
export type SearchFilter = 'all' | MediaType
export type Theme = 'dark' | 'light'
export type SportsMatch = { id: string; sport: 'football' | 'basketball' | 'tennis' | 'other'; competition: string; home: string; away: string; startTime: string; streams: Array<{ id: string; name: string; type: 'iframe' | 'external'; url: string }>; status?: 'live' | 'scheduled' | 'finished' }
export type Episode = { id: string; name: string; season: number; episode: number; thumbnail?: string; overview?: string; rating?: string; released?: string }
export type Meta = { id: string; type: MediaType; name: string; poster?: string; background?: string; logo?: string; description?: string; year?: string; releaseInfo?: string; runtime?: string; imdbRating?: string; genres?: string[]; cast?: string[]; director?: string[]; videos?: Episode[] }
export type LibraryItem = { id: number; type: MediaType; mediaId: string; name: string; poster: string; season?: number; episode?: number; position: number; duration: number; watchedAt?: string; updatedAt?: string }
export type Profile = { id: string; name: string; avatar?: string; pinHash?: string }
export type GhostSentryStatus = { enabled: boolean; idleMinutes: number; afterHour: number; idleSeconds: number; idleMinutesCurrent: number; lastActivity: number; lastReason: string; eligible: boolean; action: 'sleep' | 'restart' | 'shutdown' }
export type DLHDChannel = { channel_name: string; channel_id: string; logo_url?: string }
export type DLHDEvent = { time?: string; event: string; channels?: DLHDChannel[]; channels2?: DLHDChannel[] }
export type IPTVChannel = { id: string; name: string; url: string; logo?: string; group: string; tvgId?: string; tvgName?: string }
export type IPTVPlaylist = { name: string; channels: IPTVChannel[] }
export type EPGChannel = { id: string; displayName: string; icon?: string }
export type EPGProgram = { channelId: string; start: string; stop: string; title: string; description?: string }
export type EPGData = { channels: Record<string, EPGChannel>; programs: EPGProgram[] }

export const STORAGE = { recentSearches: 'ev0l-recent-searches', activeProfile: 'ev0l-active-profile', theme: 'ev0l-theme', profiles: 'ev0l-profiles', iptv: 'ev0l-iptv', epg: 'ev0l-epg', logos: 'ev0l-channel-logos' } as const

// SHA-256 of the owner's default local PIN. The plaintext PIN is never stored in profile data.
const DEFAULT_OMAR_PIN_HASH = '20de50c5e5cbd4d4110ad1933c7f7d9e1de584fa17a3d161b0710798dd79b439'
export const DEFAULT_PROFILES: Profile[] = [
  { id: 'omar', name: 'Omar', avatar: 'O', pinHash: DEFAULT_OMAR_PIN_HASH },
  { id: 'guest-1', name: 'Guest', avatar: 'G' },
]

export function loadProfiles(): Profile[] {
  try {
    const stored = localStorage.getItem(STORAGE.profiles)
    if (stored) {
      const parsed = JSON.parse(stored) as Profile[]
      const migrated = parsed.map((profile) => profile.id === 'omar' && !profile.pinHash ? { ...profile, pinHash: DEFAULT_OMAR_PIN_HASH } : profile)
      if (JSON.stringify(migrated) !== JSON.stringify(parsed)) localStorage.setItem(STORAGE.profiles, JSON.stringify(migrated))
      return migrated
    }
  } catch { /* use defaults */ }
  localStorage.setItem(STORAGE.profiles, JSON.stringify(DEFAULT_PROFILES))
  return DEFAULT_PROFILES
}

export function getActiveProfileId() { return localStorage.getItem(STORAGE.activeProfile) }
export function setActiveProfileId(id: string) { localStorage.setItem(STORAGE.activeProfile, id) }
export function getTheme(): Theme { return localStorage.getItem(STORAGE.theme) === 'light' ? 'light' : 'dark' }
export function applyTheme(theme: Theme) { document.documentElement.dataset.theme = theme; localStorage.setItem(STORAGE.theme, theme) }

export async function hashPin(pin: string): Promise<string> {
  const bytes = new TextEncoder().encode(pin.trim())
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
export async function verifyProfilePin(profile: Profile, pin: string): Promise<boolean> {
  if (!profile.pinHash || !/^\d{4,8}$/.test(pin.trim())) return false
  return (await hashPin(pin)) === profile.pinHash
}

async function json<T>(response: Response, label: string): Promise<T> { if (!response.ok) throw new Error(`${label} failed (${response.status})`); return response.json() as Promise<T> }
export function fetchWithTimeout(input: RequestInfo, init?: RequestInit, ms = 15000): Promise<Response> { const controller = new AbortController(); const timeoutId = setTimeout(() => controller.abort(), ms); return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timeoutId)) }
export async function getCatalog(type: MediaType): Promise<Meta[]> { const data = await json<{ metas?: Meta[] }>(await fetch(`${CINEMETA}/catalog/${type}/top.json`), 'Catalogue request'); return data.metas ?? [] }
export async function getMeta(type: MediaType, id: string): Promise<Meta> { const data = await json<{ meta: Meta }>(await fetch(`${CINEMETA}/meta/${type}/${id}.json`), 'Metadata request'); return data.meta }
export async function searchCatalog(query: string, filter: SearchFilter): Promise<Meta[]> { const types: MediaType[] = filter === 'all' ? ['movie', 'series'] : [filter]; const results = await Promise.all(types.map(async (type) => { const url = `${CINEMETA}/catalog/${type}/top/search=${encodeURIComponent(query)}.json`; const data = await json<{ metas?: Meta[] }>(await fetch(url), 'Search request'); return (data.metas ?? []).map((item) => ({ ...item, type })) })); return results.flat() }
export async function getWatchlist(): Promise<LibraryItem[]> { const data = await json<{ items?: LibraryItem[] }>(await fetchWithTimeout(`${API_BASE}/library/watchlist`), 'Watchlist request'); return data.items ?? [] }
export async function addToWatchlist(meta: Meta) { const response = await fetchWithTimeout(`${API_BASE}/library/watchlist`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: meta.type, mediaId: meta.id, name: meta.name, poster: meta.poster ?? '' }) }); if (!response.ok) throw new Error(`Add to watchlist failed (${response.status})`) }
export async function removeFromWatchlist(type: string, id: string) { const response = await fetchWithTimeout(`${API_BASE}/library/watchlist/${encodeURIComponent(type)}/${encodeURIComponent(id)}`, { method: 'DELETE' }); if (!response.ok) throw new Error(`Remove from watchlist failed (${response.status})`) }
export async function getHistory(): Promise<LibraryItem[]> { const data = await json<{ items?: LibraryItem[] }>(await fetchWithTimeout(`${API_BASE}/library/history`), 'History request'); return data.items ?? [] }
export async function saveProgress(item: Partial<LibraryItem> & Pick<LibraryItem, 'type' | 'mediaId' | 'name'>) { const response = await fetchWithTimeout(`${API_BASE}/library/history`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...item, poster: item.poster ?? '', season: item.season ?? 0, episode: item.episode ?? 0, position: item.position ?? 0, duration: item.duration ?? 0 }) }); if (!response.ok) throw new Error(`Save history failed (${response.status})`) }
export async function markSimklEpisode(mediaId: string, season: number, episode: number) { const response = await fetchWithTimeout(`${API_BASE}/simkl/episode`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mediaId, season, episode }) }); if (!response.ok) throw new Error(`Simkl sync failed (${response.status})`) }
export function mediaPath(meta: Pick<Meta, 'id' | 'type'>) { return `/title/${meta.type}/${meta.id}` }
export function itemPath(item: LibraryItem) { return item.type === 'series' && item.season && item.episode ? `/watch/series/${item.mediaId}/${item.season}/${item.episode}` : `/watch/${item.type}/${item.mediaId}` }
export function parseM3U(text: string, name = 'Imported playlist'): IPTVPlaylist { const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean); const channels: IPTVChannel[] = []; let info = ''; for (const line of lines) { if (line.startsWith('#EXTINF')) { info = line; continue } if (line.startsWith('#') || !/^https?:\/\//i.test(line)) continue; const title = info.includes(',') ? info.slice(info.lastIndexOf(',') + 1).trim() : `Channel ${channels.length + 1}`; const attr = (key: string) => info.match(new RegExp(`${key}="([^"]*)"`, 'i'))?.[1]; channels.push({ id: `${Date.now()}-${channels.length}`, name: title, url: line, logo: attr('tvg-logo'), group: attr('group-title') || 'Other', tvgId: attr('tvg-id'), tvgName: attr('tvg-name') }); info = '' } if (!channels.length) throw new Error('No playable channels were found in this playlist.'); return { name, channels } }
export function parseXMLTV(text: string): EPGData { const doc = new DOMParser().parseFromString(text, 'application/xml'); if (doc.querySelector('parsererror')) throw new Error('The XMLTV guide could not be parsed.'); const channels: Record<string, EPGChannel> = {}; const programs: EPGProgram[] = []; doc.querySelectorAll('channel').forEach((node) => { const id = node.getAttribute('id')?.trim(); if (!id) return; channels[id] = { id, displayName: node.querySelector('display-name')?.textContent?.trim() || id, icon: node.querySelector('icon')?.getAttribute('src') || undefined } }); doc.querySelectorAll('programme').forEach((node) => { const channelId = node.getAttribute('channel')?.trim(); const start = node.getAttribute('start')?.trim(); const stop = node.getAttribute('stop')?.trim(); const title = node.querySelector('title')?.textContent?.trim(); if (!channelId || !start || !stop || !title) return; programs.push({ channelId, start, stop, title, description: node.querySelector('desc')?.textContent?.trim() || undefined }) }); return { channels, programs } }
export function savePlaylist(playlist: IPTVPlaylist) { localStorage.setItem(STORAGE.iptv, JSON.stringify(playlist)) }
export function getIPTVPlaylist(): IPTVPlaylist | null { try { const value = localStorage.getItem(STORAGE.iptv); return value ? JSON.parse(value) as IPTVPlaylist : null } catch { return null } }
export function saveEPG(data: EPGData) { localStorage.setItem(STORAGE.epg, JSON.stringify(data)) }
export function getEPG(): EPGData { try { const value = localStorage.getItem(STORAGE.epg); return value ? JSON.parse(value) as EPGData : { channels: {}, programs: [] } } catch { return { channels: {}, programs: [] } } }
export async function getGhostSentry(): Promise<GhostSentryStatus> { const response = await fetch(`${API_BASE}/api/system/ghost-sentry`); if (!response.ok) throw new Error(`Ghost Sentry request failed (${response.status})`); return response.json() }
export async function setGhostSentry(enabled: boolean, pin: string): Promise<GhostSentryStatus> { const response = await fetch(`${API_BASE}/api/system/ghost-sentry`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled, pin }) }); const data = await response.json(); if (!response.ok) throw new Error(data?.error || `Ghost Sentry update failed (${response.status})`); return data }
export async function getSportsMatches(): Promise<SportsMatch[]> { const response = await fetchWithTimeout(`${API_BASE}/api/cdnlivetv/sports`); if (!response.ok) throw new Error(`CDN Live TV sports request failed: ${response.status}`); const payload = await response.json(); const events = Array.isArray(payload?.events) ? payload.events : []; return events.filter((event: any) => event?.homeTeam && event?.awayTeam).map((event: any) => ({ id: String(event.gameID), home: event.homeTeam, away: event.awayTeam, competition: event.tournament || event.sport || 'Live Sports', status: event.status === 'LIVE' ? 'live' : event.status === 'FT' ? 'finished' : 'upcoming', startTime: event.start || event.time || '', streams: Array.isArray(event.channels) ? event.channels.map((channel: any) => ({ id: `cdn-${channel.id}`, name: channel.channel_name || 'Broadcast', type: 'iframe', url: channel.url })) : [] })) }
function normalizeChannelName(value: string) { return value.toLowerCase().replace(/\b(uhd|4k|fhd|hd|sd|hevc|h265|h\.265)\b/gi, '').replace(/[^a-z0-9]+/g, ' ').trim() }
export async function resolveChannelLogos(channels: IPTVChannel[]) { let index: Record<string, string> = {}; try { index = JSON.parse(localStorage.getItem(STORAGE.logos) || '{}') as Record<string, string> } catch {} try { const records = await json<Array<{ channel: string; in_use?: boolean; url: string }>>(await fetch('https://iptv-org.github.io/api/logos.json'), 'Logo request'); for (const record of records) if (record.url && record.in_use !== false && !index[record.channel.toLowerCase()]) index[record.channel.toLowerCase()] = record.url; localStorage.setItem(STORAGE.logos, JSON.stringify(index)) } catch {} return channels.map((channel) => { if (channel.logo) return channel; const normalized = normalizeChannelName(channel.name); const direct = index[channel.name.toLowerCase()] || Object.entries(index).find(([key]) => { const candidate = normalizeChannelName(key); return candidate === normalized || candidate.includes(normalized) || normalized.includes(candidate) })?.[1]; return direct ? { ...channel, logo: direct } : channel }) }
