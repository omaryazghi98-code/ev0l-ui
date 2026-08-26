import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { EVOL_POWER_API_URL } from '../config'

type WakeLockSentinelLike = {
  released?: boolean
  release: () => Promise<void>
  addEventListener?: (type: 'release', listener: () => void) => void
}

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>
  }
}

type FullscreenTarget = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void
}

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element
}

type PlayerId =
  | 'rivestream'
  | 'vidsrc-mov'
  | 'vidsrc-fyi'
  | 'vidrock'
  | 'vidnest'
  | 'vidking'
  | 'vidlink'
  | 'vidfast'
  | 'vidup'
  | 'videasy'
  | '111movies'
  | '2embed'
  | 'multiembed'
  | 'superflix'
  | 'peachify'

type PlayerDefinition = {
  id: PlayerId
  name: string
  build: (type: 'movie' | 'series', id: string, season?: string, episode?: string) => string
}

const PLAYER_STORAGE = 'ev0l-player-provider'
const DISPATCHER = 'https://1hd.gd/watch'
const RIVESTREAM_BASE = 'https://watch.rivestream.app/embed'
const WATCH_PREFIX = '/watch/'

const dispatcherPlayers: Array<[PlayerId, string, string]> = [
  ['vidsrc-mov', 'VidSrc.mov', 'vidsrcto'],
  ['vidsrc-fyi', 'VidSrc.fyi', 'vidsrcfyi'],
  ['vidrock', 'VidRock', 'vidrock'],
  ['vidnest', 'Vidnest', 'vidnest'],
  ['vidking', 'VidKing', 'vidking'],
  ['vidlink', 'VidLink', 'vidlink'],
  ['vidfast', 'VidFast', 'vidfast'],
  ['vidup', 'VidUp', 'vidup'],
  ['videasy', 'Videasy', 'videasy'],
  ['111movies', '111Movies', '111movies'],
  ['2embed', '2Embed', '2embed'],
  ['multiembed', 'MultiEmbed', 'multiembed'],
  ['superflix', 'SuperFlix', 'superflix'],
  ['peachify', 'Peachify', 'peachify'],
]

function buildDispatcherUrl(server: string, type: 'movie' | 'series', id: string, season = '1', episode = '1') {
  const mediaType = type === 'series' ? 'tv' : 'movie'
  const path = type === 'series'
    ? `${mediaType}/${encodeURIComponent(id)}/${encodeURIComponent(season)}/${encodeURIComponent(episode)}`
    : `${mediaType}/${encodeURIComponent(id)}`
  return `${DISPATCHER}/${path}?server=${encodeURIComponent(server)}`
}

const PLAYERS: PlayerDefinition[] = [
  {
    id: 'rivestream',
    name: 'RiveStream',
    build: (type, id, season = '1', episode = '1') => {
      const params = new URLSearchParams()
      params.set('type', type === 'series' ? 'tv' : 'movie')
      params.set('id', decodeURIComponent(id))
      if (type === 'series') {
        params.set('season', decodeURIComponent(season))
        params.set('episode', decodeURIComponent(episode))
      }
      return `${RIVESTREAM_BASE}?${params.toString()}`
    },
  },
  ...dispatcherPlayers.map(([id, name, server]) => ({
    id,
    name,
    build: (type: 'movie' | 'series', mediaId: string, season = '1', episode = '1') =>
      buildDispatcherUrl(server, type, mediaId, season, episode),
  })),
]

function readSelectedPlayer(): PlayerId {
  const stored = localStorage.getItem(PLAYER_STORAGE) as PlayerId | null
  return PLAYERS.some((player) => player.id === stored) ? stored! : 'rivestream'
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
    // Playback must never fail because activity reporting is unavailable.
  } finally {
    window.clearTimeout(timeout)
  }
}

function findWatchIframe() {
  return document.querySelector<HTMLIFrameElement>('.app-content iframe')
}

function findNativeVideo() {
  return document.querySelector<HTMLVideoElement>('.app-content video')
}

export default function PlaybackManager() {
  const location = useLocation()
  const isWatchRoute = location.pathname.startsWith(WATCH_PREFIX)
  const [hasIframe, setHasIframe] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerId>(() => readSelectedPlayer())
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null)
  const nativeVideoCleanupRef = useRef<(() => void) | null>(null)
  const nativeVideoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (!isWatchRoute) {
      setHasIframe(false)
      setFullscreen(false)
      nativeVideoCleanupRef.current?.()
      nativeVideoCleanupRef.current = null
      nativeVideoRef.current = null
      return
    }

    let stopped = false
    let heartbeat = 0
    let observer: MutationObserver | null = null
    const parts = location.pathname.split('/').filter(Boolean)
    const type = parts[1] === 'series' ? 'series' : 'movie'
    const id = parts[2] || ''
    const season = parts[3] || '1'
    const episode = parts[4] || '1'

    const releaseWakeLock = async () => {
      const sentinel = wakeLockRef.current
      wakeLockRef.current = null
      if (!sentinel) return
      try {
        await sentinel.release()
      } catch {
        // Ignore release failures.
      }
    }

    const requestWakeLock = async () => {
      if (stopped || document.visibilityState !== 'visible') return

      const wakeLock = (navigator as NavigatorWithWakeLock).wakeLock
      if (!wakeLock) return
      if (wakeLockRef.current && !wakeLockRef.current.released) return

      try {
        const sentinel = await wakeLock.request('screen')
        if (stopped) {
          await sentinel.release().catch(() => undefined)
          return
        }
        wakeLockRef.current = sentinel
        sentinel.addEventListener?.('release', () => {
          wakeLockRef.current = null
        })
      } catch {
        // Browser may require user activation or may not support wake lock.
      }
    }

    const configureIframe = () => {
      const iframe = findWatchIframe()
      if (!iframe) {
        setHasIframe(false)
        return
      }

      const player = PLAYERS.find((item) => item.id === selectedPlayer) || PLAYERS[0]
      const desiredUrl = player.build(type, id, season, episode)

      iframe.setAttribute('allowfullscreen', 'true')
      iframe.setAttribute(
        'allow',
        'autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer; screen-wake-lock',
      )

      if (desiredUrl && iframe.src !== desiredUrl) {
        iframe.src = desiredUrl
      }

      setHasIframe(true)
    }

    const activity = () => {
      void reportActivity('watching')
      void requestWakeLock()
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void requestWakeLock()
        void reportActivity('watching-visible')
      } else {
        void releaseWakeLock()
      }
    }

    const onFullscreenChange = () => {
      const doc = document as FullscreenDocument
      const active = Boolean(document.fullscreenElement || doc.webkitFullscreenElement)
      setFullscreen(active)
      void reportActivity(active ? 'fullscreen-enter' : 'fullscreen-exit')
    }

    const attachNativeVideo = () => {
      const video = findNativeVideo()
      if (!video || video === nativeVideoRef.current) return

      nativeVideoCleanupRef.current?.()
      nativeVideoCleanupRef.current = null
      nativeVideoRef.current = video

      const onPlay = () => activity()
      const onPlaying = () => activity()
      const onPause = () => void reportActivity('watch-paused')
      const onEnded = () => void reportActivity('watch-ended')
      const onTimeUpdate = () => void reportActivity('watch-progress')

      video.addEventListener('play', onPlay)
      video.addEventListener('playing', onPlaying)
      video.addEventListener('pause', onPause)
      video.addEventListener('ended', onEnded)
      video.addEventListener('timeupdate', onTimeUpdate)

      nativeVideoCleanupRef.current = () => {
        video.removeEventListener('play', onPlay)
        video.removeEventListener('playing', onPlaying)
        video.removeEventListener('pause', onPause)
        video.removeEventListener('ended', onEnded)
        video.removeEventListener('timeupdate', onTimeUpdate)
      }
    }

    const refreshPlayerHooks = () => {
      configureIframe()
      attachNativeVideo()
    }

    refreshPlayerHooks()
    void requestWakeLock()
    void reportActivity('watch-enter')

    observer = new MutationObserver(refreshPlayerHooks)
    observer.observe(document.body, { childList: true, subtree: true })

    document.addEventListener('visibilitychange', onVisibilityChange)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    document.addEventListener('webkitfullscreenchange', onFullscreenChange as EventListener)
    window.addEventListener('pointerdown', activity, { passive: true })
    window.addEventListener('touchstart', activity, { passive: true })
    window.addEventListener('keydown', activity)

    heartbeat = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void reportActivity('watch-heartbeat')
        void requestWakeLock()
      }
    }, 30000)

    return () => {
      stopped = true
      if (heartbeat) window.clearInterval(heartbeat)
      observer?.disconnect()
      nativeVideoCleanupRef.current?.()
      nativeVideoCleanupRef.current = null
      nativeVideoRef.current = null
      document.removeEventListener('visibilitychange', onVisibilityChange)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange as EventListener)
      window.removeEventListener('pointerdown', activity)
      window.removeEventListener('touchstart', activity)
      window.removeEventListener('keydown', activity)
      void releaseWakeLock()
      void reportActivity('watch-exit')
    }
  }, [isWatchRoute, location.pathname, selectedPlayer])

  async function requestFullscreen() {
    const iframe = findWatchIframe()
    const video = findNativeVideo()
    const target = (video || iframe) as FullscreenTarget | null
    if (!target) return

    try {
      if (target.requestFullscreen) {
        await target.requestFullscreen()
      } else {
        await target.webkitRequestFullscreen?.()
      }
    } catch {
      // iOS/Safari may refuse iframe fullscreen; provider-native controls remain available.
    }

    await reportActivity('fullscreen-request')
  }

  function selectPlayer(player: PlayerDefinition) {
    localStorage.setItem(PLAYER_STORAGE, player.id)
    setSelectedPlayer(player.id)
    void reportActivity(`player-selected:${player.id}`)
  }

  if (!isWatchRoute) return null

  const activePlayer = PLAYERS.find((player) => player.id === selectedPlayer) || PLAYERS[0]

  return (
    <div
      style={{
        position: 'fixed',
        top: '5.75rem',
        right: '1rem',
        zIndex: 1200,
        display: hasIframe ? 'flex' : 'none',
        alignItems: 'center',
        gap: '.45rem',
      }}
    >
      <label
        title="Choose player"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '.35rem',
          padding: '.35rem .55rem',
          border: '1px solid rgba(255,255,255,.16)',
          borderRadius: '999px',
          background: 'rgba(9,12,16,.82)',
          color: 'white',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <span style={{ fontSize: '.72rem', opacity: .72 }}>Player</span>
        <select
          value={activePlayer.id}
          onChange={(event) => {
            const next = PLAYERS.find((player) => player.id === event.target.value)
            if (next) selectPlayer(next)
          }}
          style={{
            maxWidth: '8.5rem',
            border: 0,
            outline: 0,
            background: 'transparent',
            color: 'white',
            font: 'inherit',
            fontSize: '.78rem',
          }}
        >
          {PLAYERS.map((player) => (
            <option key={player.id} value={player.id} style={{ color: 'black' }}>
              {player.name}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        onClick={() => void requestFullscreen()}
        aria-label={fullscreen ? 'Fullscreen active' : 'Enter fullscreen'}
        title={fullscreen ? 'Fullscreen active' : 'Enter fullscreen'}
        style={{
          display: 'grid',
          placeItems: 'center',
          width: '2.75rem',
          height: '2.75rem',
          border: '1px solid rgba(255,255,255,.16)',
          borderRadius: '999px',
          background: 'rgba(9,12,16,.82)',
          color: 'white',
          fontSize: '1.35rem',
          lineHeight: 1,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          cursor: 'pointer',
        }}
      >
        ⛶
      </button>
    </div>
  )
}
