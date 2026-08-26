import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'

type NativeVideoPlayerProps = {
  src: string
  title?: string
  onExit: () => void
}

function isTizen() {
  return typeof window !== 'undefined' && Boolean((window as Window & { tizen?: unknown }).tizen)
}

export function NativeVideoPlayer({ src, title = 'EV0L TV', onExit }: NativeVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [error, setError] = useState('')
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    setError('')
    hlsRef.current?.destroy()
    hlsRef.current = null

    const onPlaying = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onVideoError = () => setError('The stream could not be played by the TV browser.')

    video.addEventListener('playing', onPlaying)
    video.addEventListener('pause', onPause)
    video.addEventListener('error', onVideoError)

    const isHls = /\.m3u8(?:$|\?)/i.test(src)
    if (isHls && Hls.isSupported() && !isTizen()) {
      const hls = new Hls({ enableWorker: true })
      hlsRef.current = hls
      hls.loadSource(src)
      hls.attachMedia(video)
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) setError('The HLS stream reported a fatal playback error.')
      })
    } else {
      video.src = src
    }

    return () => {
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('error', onVideoError)
      hlsRef.current?.destroy()
      hlsRef.current = null
      video.removeAttribute('src')
      video.load()
    }
  }, [src])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const video = videoRef.current
      if (!video) return

      switch (event.keyCode) {
        case 13: // Enter / OK
        case 10252: // Samsung Play/Pause
        case 19:
          event.preventDefault()
          if (video.paused) video.play().catch(() => undefined)
          else video.pause()
          break
        case 415: // Play
          event.preventDefault()
          video.play().catch(() => undefined)
          break
        case 412: // Rewind
          event.preventDefault()
          video.currentTime = Math.max(0, video.currentTime - 30)
          break
        case 417: // Fast forward
          event.preventDefault()
          video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 30)
          break
        case 10009: // Back
        case 8:
        case 461:
          event.preventDefault()
          onExit()
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onExit])

  return (
    <main className="native-player" aria-label="EV0L TV player">
      <video
        ref={videoRef}
        className="native-player__video"
        controls
        playsInline
        autoPlay
        preload="metadata"
        aria-label={title}
      />
      <div className="native-player__hud">
        <span>{title}</span>
        <span>{playing ? 'Playing' : 'Paused'}</span>
      </div>
      {error && (
        <div className="native-player__error" role="alert">
          <strong>Playback error</strong>
          <span>{error}</span>
          <button onClick={onExit}>Back</button>
        </div>
      )}
    </main>
  )
}
