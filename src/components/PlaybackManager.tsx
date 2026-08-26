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

const RIVESTREAM_BASE = 'https://watch.rivestream.app/embed'
const WATCH_PREFIX = '/watch/'

function buildRiveStreamUrl(pathname: string) {
  const parts = pathname.split('/').filter(Boolean)
  if (parts[0] !== 'watch') return ''

  const type = parts[1]
  const id = parts[2]
  if (!id || (type !== 'movie' && type !== 'series')) return ''

  const params = new URLSearchParams()
  params.set('type', type === 'series' ? 'tv' : 'movie')
  params.set('id', decodeURIComponent(id))

  if (type === 'series') {
    const season = parts[3]
    const episode = parts[4]
    if (season) params.set('season', decodeURIComponent(season))
    if (episode) params.set('episode', decodeURIComponent(episode))
  }

  return `${RIVESTREAM_BASE}?${params.toString()}`
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
    const riveUrl = buildRiveStreamUrl(location.pathname)

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

      iframe.setAttribute('allowfullscreen', 'true')
      iframe.setAttribute(
        'allow',
        'autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer; screen-wake-lock',
      )

      if (riveUrl && iframe.src !== riveUrl) {
        iframe.src = riveUrl
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
  }, [isWatchRoute, location.pathname])

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

  if (!isWatchRoute) return null

  return (
    <button
      type="button"
      onClick={() => void requestFullscreen()}
      aria-label={fullscreen ? 'Fullscreen active' : 'Enter fullscreen'}
      title={fullscreen ? 'Fullscreen active' : 'Enter fullscreen'}
      style={{
        position: 'fixed',
        top: '5.75rem',
        right: '1rem',
        zIndex: 1200,
        display: hasIframe ? 'grid' : 'none',
        placeItems: 'center',
        width: '2.75rem',
        height: '2.75rem',
        border: '1px solid rgba(255,255,255,.16)',
        borderRadius: '999px',
        background: 'rgba(9,12,16,.78)',
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
  )
}
