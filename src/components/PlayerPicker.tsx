import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { EVOL_POWER_API_URL } from '../config'

type WakeLockSentinelLike = {
  released?: boolean
  release: () => Promise<void>
}

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> }
}

type Player = {
  id: string
  name: string
  requiresTmdb?: boolean
  build: (type: 'movie' | 'series', id: string, season: string, episode: string) => string
}

const STORAGE_KEY = 'ev0l-player-provider'
const RIVESTREAM = 'https://watch.rivestream.app/embed'

const PLAYERS: Player[] = [
  {
    id: 'rivestream',
    name: 'RiveStream',
    build: (type, id, season, episode) => {
      const params = new URLSearchParams({ type: type === 'series' ? 'tv' : 'movie', id: decodeURIComponent(id) })
      if (type === 'series') {
        params.set('season', decodeURIComponent(season))
        params.set('episode', decodeURIComponent(episode))
      }
      return `${RIVESTREAM}?${params.toString()}`
    },
  },
  {
    id: 'vidsrc-mov',
    name: 'VidSrc.mov',
    build: (type, id, season, episode) => type === 'series'
      ? `https://vidsrc.mov/embed/tv/${encodeURIComponent(id)}/${encodeURIComponent(season)}/${encodeURIComponent(episode)}`
      : `https://vidsrc.mov/embed/movie/${encodeURIComponent(id)}`,
  },
  {
    id: 'vidsrc-fyi',
    name: 'VidSrc.fyi',
    build: (type, id, season, episode) => type === 'series'
      ? `https://vidsrc.fyi/embed/tv/${encodeURIComponent(id)}/${encodeURIComponent(season)}/${encodeURIComponent(episode)}`
      : `https://vidsrc.fyi/embed/movie/${encodeURIComponent(id)}`,
  },
  {
    id: 'vidfast',
    name: 'VidFast',
    build: (type, id, season, episode) => type === 'series'
      ? `https://vidfast.to/embed/tv/${encodeURIComponent(id)}/${encodeURIComponent(season)}/${encodeURIComponent(episode)}`
      : `https://vidfast.to/embed/movie/${encodeURIComponent(id)}`,
  },
  {
    id: 'vidrock',
    name: 'VidRock',
    build: (type, id, season, episode) => type === 'series'
      ? `https://vidrock.net/embed/tv/${encodeURIComponent(id)}/${encodeURIComponent(season)}/${encodeURIComponent(episode)}`
      : `https://vidrock.net/embed/movie/${encodeURIComponent(id)}`,
  },
  {
    id: 'videasy',
    name: 'Videasy',
    build: (type, id, season, episode) => type === 'series'
      ? `https://player.videasy.net/tv/${encodeURIComponent(id)}/${encodeURIComponent(season)}/${encodeURIComponent(episode)}`
      : `https://player.videasy.net/movie/${encodeURIComponent(id)}`,
  },
  {
    id: '111movies',
    name: '111Movies',
    build: (type, id, season, episode) => type === 'series'
      ? `https://111movies.com/tv/${encodeURIComponent(id)}/${encodeURIComponent(season)}/${encodeURIComponent(episode)}`
      : `https://111movies.com/movie/${encodeURIComponent(id)}`,
  },
  {
    id: '2embed',
    name: '2Embed',
    build: (type, id, season, episode) => type === 'series'
      ? `https://www.2embedstream.xyz/embed/tv/${encodeURIComponent(id)}/${encodeURIComponent(season)}/${encodeURIComponent(episode)}`
      : `https://www.2embedstream.xyz/embed/movie/${encodeURIComponent(id)}`,
  },
  {
    id: 'multiembed',
    name: 'MultiEmbed',
    build: (type, id, season, episode) => {
      const params = new URLSearchParams({ video_id: decodeURIComponent(id), tmdb: '0' })
      if (type === 'series') {
        params.set('s', season)
        params.set('e', episode)
      }
      return `https://multiembed.mov/?${params.toString()}`
    },
  },
  {
    id: 'vidking',
    name: 'VidKing (TMDB)',
    requiresTmdb: true,
    build: (type, id, season, episode) => type === 'series'
      ? `https://www.vidking.net/embed/tv/${encodeURIComponent(id)}/${encodeURIComponent(season)}/${encodeURIComponent(episode)}`
      : `https://www.vidking.net/embed/movie/${encodeURIComponent(id)}`,
  },
  {
    id: 'vidlink',
    name: 'VidLink (TMDB)',
    requiresTmdb: true,
    build: (type, id, season, episode) => type === 'series'
      ? `https://vidlink.pro/tv/${encodeURIComponent(id)}/${encodeURIComponent(season)}/${encodeURIComponent(episode)}`
      : `https://vidlink.pro/movie/${encodeURIComponent(id)}`,
  },
]

function isTmdbId(id: string) {
  return /^\d+$/.test(id)
}

async function reportActivity(reason: string) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 5000)
  try {
    await fetch(`${EVOL_POWER_API_URL}/api/system/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
      signal: controller.signal,
    })
  } catch {
    // Never block playback on activity reporting.
  } finally {
    window.clearTimeout(timeout)
  }
}

function getStoredPlayer() {
  const id = localStorage.getItem(STORAGE_KEY)
  return PLAYERS.some((player) => player.id === id) ? id! : 'rivestream'
}

export default function PlayerPicker() {
  const location = useLocation()
  const isWatch = location.pathname.startsWith('/watch/')
  const parts = useMemo(() => location.pathname.split('/').filter(Boolean), [location.pathname])
  const type = parts[1] === 'series' ? 'series' : 'movie'
  const id = parts[2] || ''
  const season = parts[3] || '1'
  const episode = parts[4] || '1'
  const [selected, setSelected] = useState(getStoredPlayer)
  const [frameReady, setFrameReady] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null)

  const availablePlayers = useMemo(() => PLAYERS.filter((player) => !player.requiresTmdb || isTmdbId(id)), [id])
  const activePlayer = availablePlayers.find((player) => player.id === selected) || availablePlayers[0] || PLAYERS[0]

  useEffect(() => {
    if (!isWatch || !id) return

    if (!availablePlayers.some((player) => player.id === selected)) {
      const fallback = availablePlayers[0]?.id || 'rivestream'
      setSelected(fallback)
      localStorage.setItem(STORAGE_KEY, fallback)
    }
  }, [availablePlayers, id, isWatch, selected])

  useEffect(() => {
    if (!isWatch) return

    let stopped = false
    let heartbeat = 0

    const releaseWakeLock = async () => {
      const sentinel = wakeLockRef.current
      wakeLockRef.current = null
      if (!sentinel) return
      try { await sentinel.release() } catch { /* ignore */ }
    }

    const requestWakeLock = async () => {
      if (stopped || document.visibilityState !== 'visible') return
      const wakeLock = (navigator as NavigatorWithWakeLock).wakeLock
      if (!wakeLock || wakeLockRef.current?.released === false) return
      try {
        const sentinel = await wakeLock.request('screen')
        if (stopped) {
          await sentinel.release().catch(() => undefined)
          return
        }
        wakeLockRef.current = sentinel
      } catch {
        // Unsupported or not permitted by the browser.
      }
    }

    const activity = () => {
      void reportActivity('watching')
      void requestWakeLock()
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void requestWakeLock()
        void reportActivity('watching-visible')
      } else {
        void releaseWakeLock()
      }
    }

    const onFullscreen = () => {
      setFullscreen(Boolean(document.fullscreenElement))
      void reportActivity(document.fullscreenElement ? 'fullscreen-enter' : 'fullscreen-exit')
    }

    document.addEventListener('visibilitychange', onVisibility)
    document.addEventListener('fullscreenchange', onFullscreen)
    window.addEventListener('pointerdown', activity, { passive: true })
    window.addEventListener('touchstart', activity, { passive: true })
    window.addEventListener('keydown', activity)
    heartbeat = window.setInterval(() => {
      if (document.visibilityState === 'visible') void reportActivity('watch-heartbeat')
    }, 30000)

    void requestWakeLock()
    void reportActivity('watch-enter')

    return () => {
      stopped = true
      if (heartbeat) window.clearInterval(heartbeat)
      document.removeEventListener('visibilitychange', onVisibility)
      document.removeEventListener('fullscreenchange', onFullscreen)
      window.removeEventListener('pointerdown', activity)
      window.removeEventListener('touchstart', activity)
      window.removeEventListener('keydown', activity)
      void releaseWakeLock()
      void reportActivity('watch-exit')
    }
  }, [isWatch, location.pathname])

  useEffect(() => {
    if (!isWatch) return
    const iframe = document.querySelector<HTMLIFrameElement>('.player-stage iframe')
    if (!iframe || !id) return
    setFrameReady(false)
    const url = activePlayer.build(type, id, season, episode)
    iframe.src = url
    iframe.setAttribute('allowfullscreen', 'true')
    iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer; screen-wake-lock')
    const onLoad = () => setFrameReady(true)
    iframe.addEventListener('load', onLoad)
    return () => iframe.removeEventListener('load', onLoad)
  }, [activePlayer, episode, id, isWatch, season, type])

  async function requestFullscreen() {
    const iframe = document.querySelector<HTMLIFrameElement>('.player-stage iframe')
    if (!iframe) return
    try {
      if (iframe.requestFullscreen) await iframe.requestFullscreen()
      else await (iframe as HTMLIFrameElement & { webkitRequestFullscreen?: () => Promise<void> | void }).webkitRequestFullscreen?.()
    } catch {
      // Provider/browser may restrict programmatic iframe fullscreen.
    }
    void reportActivity('fullscreen-request')
  }

  function choose(player: Player) {
    setSelected(player.id)
    localStorage.setItem(STORAGE_KEY, player.id)
    void reportActivity(`player-selected:${player.id}`)
  }

  if (!isWatch || !id) return null

  return (
    <div style={{ position: 'fixed', top: '5.75rem', right: '1rem', zIndex: 1200, display: 'flex', alignItems: 'center', gap: '.45rem' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '.35rem', padding: '.35rem .55rem', border: '1px solid rgba(255,255,255,.16)', borderRadius: '999px', background: 'rgba(9,12,16,.84)', color: 'white', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
        <span style={{ fontSize: '.72rem', opacity: .72 }}>Player</span>
        <select value={activePlayer.id} onChange={(event) => { const next = PLAYERS.find((player) => player.id === event.target.value); if (next) choose(next) }} style={{ maxWidth: '10rem', border: 0, outline: 0, background: 'transparent', color: 'white', font: 'inherit', fontSize: '.78rem' }}>
          {availablePlayers.map((player) => (
            <option key={player.id} value={player.id} style={{ color: 'black' }}>{player.name}</option>
          ))}
        </select>
      </label>
      <button type="button" onClick={() => void requestFullscreen()} aria-label={fullscreen ? 'Fullscreen active' : 'Enter fullscreen'} title={fullscreen ? 'Fullscreen active' : 'Enter fullscreen'} style={{ display: frameReady ? 'grid' : 'none', placeItems: 'center', width: '2.75rem', height: '2.75rem', border: '1px solid rgba(255,255,255,.16)', borderRadius: '999px', background: 'rgba(9,12,16,.84)', color: 'white', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer' }}>⛶</button>
    </div>
  )
}
