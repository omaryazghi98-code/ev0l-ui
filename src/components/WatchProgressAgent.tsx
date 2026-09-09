import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { getHistory, saveProgress } from '../lib/ev0l'

const PLAYER_ORIGIN = 'https://vidsrc.tw'
const SAVE_INTERVAL_MS = 5000
const MIN_PROGRESS_SECONDS = 20
const RESUME_GUARD_SECONDS = 120

type RouteState = {
  type: 'movie' | 'series'
  id: string
  season?: number
  episode?: number
}

type PlayerEvent = {
  type?: string
  data?: {
    player_info?: {
      imdb?: string | null
      tmdb?: string | number | null
      mediaType?: 'movie' | 'tv'
      season?: number | string | null
      episode?: number | string | null
    }
    player_status?: 'playing' | 'paused' | 'completed' | 'seeked' | string
    player_progress?: number
    player_duration?: number
  }
}

function parseRoute(pathname: string): RouteState | null {
  const parts = pathname.split('/').filter(Boolean)
  if (parts[0] !== 'watch' || !parts[1] || !parts[2]) return null
  const type = parts[1] === 'series' ? 'series' : parts[1] === 'movie' ? 'movie' : null
  if (!type) return null

  return {
    type,
    id: decodeURIComponent(parts[2]),
    season: parts[3] ? Number(parts[3]) : undefined,
    episode: parts[4] ? Number(parts[4]) : undefined,
  }
}

function sameMedia(info: NonNullable<NonNullable<PlayerEvent['data']>['player_info']>, route: RouteState) {
  if (info.mediaType && ((route.type === 'series' && info.mediaType !== 'tv') || (route.type === 'movie' && info.mediaType !== 'movie'))) {
    return false
  }

  const ids = [info.imdb, info.tmdb == null ? null : String(info.tmdb)].filter(Boolean)
  if (ids.length > 0 && !ids.includes(route.id)) return false

  if (route.type === 'series') {
    const infoSeason = info.season == null ? undefined : Number(info.season)
    const infoEpisode = info.episode == null ? undefined : Number(info.episode)
    if (route.season != null && infoSeason != null && route.season !== infoSeason) return false
    if (route.episode != null && infoEpisode != null && route.episode !== infoEpisode) return false
  }

  return true
}

function withResume(src: string, position: number) {
  const url = new URL(src)
  url.searchParams.set('startAt', String(Math.floor(position)))
  return url.toString()
}

export default function WatchProgressAgent() {
  const location = useLocation()

  useEffect(() => {
    const route = parseRoute(location.pathname)
    if (!route) return

    let disposed = false
    let lastSaved = 0
    let latest: { progress: number; duration: number; status: string } | null = null
    let historyItem: any = null

    const findIframe = () =>
      Array.from(document.querySelectorAll<HTMLIFrameElement>('iframe[src*="vidsrc.tw"]'))[0] ?? null

    const loadHistory = async () => {
      try {
        const history = await getHistory()
        if (disposed) return
        historyItem = history.find((item: any) => {
          if (item.type !== route.type || String(item.mediaId) !== route.id) return false
          if (route.type === 'series') {
            return Number(item.season ?? 1) === Number(route.season ?? 1) && Number(item.episode ?? 1) === Number(route.episode ?? 1)
          }
          return true
        }) ?? null

        const position = Number(historyItem?.position ?? 0)
        const duration = Number(historyItem?.duration ?? 0)
        if (position < MIN_PROGRESS_SECONDS || (duration > 0 && position >= duration - RESUME_GUARD_SECONDS)) return

        const iframe = findIframe()
        if (!iframe || iframe.dataset.ev0lResumeApplied === '1') return

        const current = iframe.getAttribute('src') ?? ''
        if (!current.startsWith(PLAYER_ORIGIN)) return
        iframe.dataset.ev0lResumeApplied = '1'
        iframe.src = withResume(current, position)
      } catch {
        // Playback must never be blocked by history/resume failures.
      }
    }

    const persist = async () => {
      if (!latest || latest.progress < MIN_PROGRESS_SECONDS || !Number.isFinite(latest.progress)) return
      if (!historyItem) {
        try {
          const history = await getHistory()
          historyItem = history.find((item: any) => {
            if (item.type !== route.type || String(item.mediaId) !== route.id) return false
            if (route.type === 'series') {
              return Number(item.season ?? 1) === Number(route.season ?? 1) && Number(item.episode ?? 1) === Number(route.episode ?? 1)
            }
            return true
          }) ?? null
        } catch {
          return
        }
      }

      const now = Date.now()
      if (now - lastSaved < 1500) return
      lastSaved = now

      try {
        await saveProgress({
          type: route.type,
          mediaId: route.id,
          name: historyItem?.name ?? route.id,
          poster: historyItem?.poster ?? '',
          season: route.type === 'series' ? Number(route.season ?? 1) : undefined,
          episode: route.type === 'series' ? Number(route.episode ?? 1) : undefined,
          position: latest.progress,
          duration: latest.duration,
        } as any)
      } catch {
        // A failed progress write must never interrupt playback.
      }
    }

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== PLAYER_ORIGIN) return
      if (event.source && findIframe()?.contentWindow && event.source !== findIframe()?.contentWindow) return

      const payload: PlayerEvent = typeof event.data === 'string'
        ? (() => {
            try { return JSON.parse(event.data) } catch { return {} }
          })()
        : event.data

      if (payload?.type !== 'PLAYER_EVENT' || !payload.data) return
      const info = payload.data.player_info
      if (!info || !sameMedia(info, route)) return

      const progress = Number(payload.data.player_progress)
      const duration = Number(payload.data.player_duration)
      if (!Number.isFinite(progress)) return

      latest = {
        progress: Math.max(0, progress),
        duration: Number.isFinite(duration) ? Math.max(0, duration) : 0,
        status: String(payload.data.player_status ?? ''),
      }

      if (latest.status === 'playing' || latest.status === 'paused' || latest.status === 'seeked' || latest.status === 'completed') {
        void persist()
      }
    }

    const interval = window.setInterval(() => {
      if (latest?.status === 'playing') void persist()
    }, SAVE_INTERVAL_MS)

    void loadHistory()
    window.addEventListener('message', onMessage)
    window.addEventListener('pagehide', () => { void persist() }, { once: true })

    return () => {
      disposed = true
      window.clearInterval(interval)
      window.removeEventListener('message', onMessage)
      if (latest?.status === 'playing') void persist()
    }
  }, [location.pathname])

  return null
}
