import { useEffect, useRef } from 'react'
import { getSimklStatus, syncSimkl } from '../lib/simkl'

const INITIAL_DELAY_MS = 4000
const SYNC_INTERVAL_MS = 15 * 60 * 1000

export default function SimklSyncAgent() {
  const syncingRef = useRef(false)

  useEffect(() => {
    if (getSimklStatus() !== 'connected') return

    let stopped = false

    const run = async () => {
      if (stopped || syncingRef.current || document.visibilityState !== 'visible') return
      syncingRef.current = true
      try {
        await syncSimkl()
      } catch (error) {
        console.warn('EV0L Simkl background sync failed:', error)
      } finally {
        syncingRef.current = false
      }
    }

    const initial = window.setTimeout(() => void run(), INITIAL_DELAY_MS)
    const interval = window.setInterval(() => void run(), SYNC_INTERVAL_MS)

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void run()
    }
    window.addEventListener('focus', onVisibilityChange)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      stopped = true
      window.clearTimeout(initial)
      window.clearInterval(interval)
      window.removeEventListener('focus', onVisibilityChange)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  return null
}
