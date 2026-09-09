import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { getHistory, saveProgress, type LibraryItem } from '../lib/ev0l'

const PLAYER_ORIGIN = 'https://vidsrc.tw'
const MIN_SAVED_SECONDS = 20
const SAVE_INTERVAL_MS = 5000
const END_BUFFER_SECONDS = 120

type WatchRoute = {
  type: 'movie' | 'series'
  id: string
  season: number
  episode: number
}

type PlayerInfo = {
  imdb?: string | null
  tmdb?: string | number | null
  mediaType?: 'movie' | 'tv' | string
  season?: number | string | null
  episode?: number | string | null
}

type PlayerEventPayload = {
  type?: string
  data?: {
    player_info?: PlayerInfo
    player_status?: 'playing' | 'paused' | 'completed' | 'seeked' | string
    player_progress?: number
    player_duration?: number
  }
}

function parseRoute(pathname: string): WatchRoute | null {
  const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent)
  if (parts[0] !== 'watch' || !parts[1] || !parts[2]) return null
  if (parts[1] === 'movie') return { type: 'movie', id: parts[2], season: 0, episode: 0 }
  if (parts[1] === 'series' && parts[3] && parts[4]) {
    const season = Number(parts[3])
    const episode = Number(parts[4])
    if (Number.isFinite(season) && Number.isFinite(episode)) return { type: 'series', id: parts[2], season, episode }
  }
  return null
}

function asNumber(value: unknown): number {
  const result = Number(value)
  return Number.isFinite(result) ? result : 0
}

function parseMessage(value: unknown): PlayerEventPayload | null {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as PlayerEventPayload
    } catch {
      return null
    }
  }
  return value && typeof value === 'object' ? value as PlayerEventPayload : null
}

function findPlayerFrame(): HTMLIFrameElement | null {
  return Array.from(document.querySelectorAll<HTMLIFrameElement>('iframe')).find((frame) => {
    try {
      return new URL(frame.src, window.location.href).origin === PLAYER_ORIGIN
    } catch {
      return false
    }
  }) || null
}

function matchesRoute(info: PlayerInfo, route: WatchRoute) {
  const ids = [info.imdb, info.tmdb].filter((value) => value !== null && value !== undefined).map(String)
  if (!ids.includes(route.id)) return false

  const expectedType = route.type === 'series' ? 'tv' : 'movie'
  if (info.mediaType && info.mediaType !== expectedType) return false

  if (route.type === 'series') {
    if (info.season != null && asNumber(info.season) !== route.season) return false
    if (info.episode != null && asNumber(info.episode) !== route.episode) return false
  }

  return true
}

export default function WatchProgressAgent() {
  const location = useLocation()
  const lastSaveRef = useRef(0)
  const historyRef = useRef<LibraryItem | null>(null)
  const latestRef = useRef({ progress: 0, duration: 0, name: '', poster: '' })
  const route = parseRoute(location.pathname)

  useEffect(() => {
    if (!route) return

    let cancelled = false
    lastSaveRef.current = 0
    historyRef.current = null
    latestRef.current = { progress: 0, duration: 0, name: '', poster: '' }

    getHistory().then((items) => {
      if (cancelled) return
      const match = items.find((item) =>
        item.type === route.type &&
        item.mediaId === route.id &&
        Number(item.season || 0) === route.season &&
        Number(item.episode || 0) === route.episode,
      )
      historyRef.current = match || null

      const position = Number(match?.position || 0)
      const duration = Number(match?.duration || 0)
      if (position < MIN_SAVED_SECONDS || (duration > 0 && position >= Math.max(0, duration - END_BUFFER_SECONDS))) return

      const applyResume = () => {
        if (cancelled) return false
        const frame = findPlayerFrame()
        if (!frame) return false
        if (frame.dataset.evolResumeApplied === '1') return true
        const current = new URL(frame.src, window.location.href)
        if (current.searchParams.has('startAt')) {
          frame.dataset.evolResumeApplied = '1'
          return true
        }
        current.searchParams.set('startAt', String(Math.floor(position)))
        frame.dataset.evolResumeApplied = '1'
        frame.src = current.toString()
        return true
      }

      if (!applyResume()) {
        const timer = window.setInterval(() => {
          if (applyResume()) window.clearInterval(timer)
        }, 250)
        window.setTimeout(() => window.clearInterval(timer), 10000)
      }
    }).catch(() => {})

    const persist = (position: number, duration: number, status: string) => {
      const latest = latestRef.current
      if (!latest.name) return
      if (status !== 'completed' && position < MIN_SAVED_SECONDS) return
      lastSaveRef.current = Date.now()
      void saveProgress({
        type: route.type,
        mediaId: route.id,
        name: latest.name,
        poster: latest.poster,
        season: route.season,
        episode: route.episode,
        position: status === 'completed' ? duration || position : position,
        duration,
      })
    }

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== PLAYER_ORIGIN) return
      const frame = findPlayerFrame()
      if (frame && event.source !== frame.contentWindow) return

      const payload = parseMessage(event.data)
      if (payload?.type !== 'PLAYER_EVENT' || !payload.data) return
      const info = payload.data.player_info || {}
      if (!matchesRoute(info, route)) return

      const progress = asNumber(payload.data.player_progress)
      const duration = asNumber(payload.data.player_duration)
      const status = payload.data.player_status || ''
      const history = historyRef.current

      latestRef.current = {
        progress,
        duration,
        name: history?.name || '',
        poster: history?.poster || '',
      }

      const terminal = status === 'paused' || status === 'seeked' || status === 'completed'
      if (!terminal && Date.now() - lastSaveRef.current < SAVE_INTERVAL_MS) return
      persist(progress, duration, status)
    }

    const onPageHide = () => {
      const latest = latestRef.current
      if (!latest.name || latest.progress < MIN_SAVED_SECONDS) return
      persist(latest.progress, latest.duration, 'pagehide')
    }

    window.addEventListener('message', onMessage)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      cancelled = true
      window.removeEventListener('message', onMessage)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [location.pathname])

  return null
}
