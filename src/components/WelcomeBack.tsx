import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

type WelcomeItem = {
  name: string
  poster?: string
  type: string
  mediaId?: string
  season?: number
  episode?: number
}

type Props = {
  item?: WelcomeItem
}

export default function WelcomeBack({ item }: Props) {
  const navigate = useNavigate()

  const [visible, setVisible] = useState(
    () => sessionStorage.getItem('ev0l-welcome-shown') !== '1',
  )

  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('ev0l-welcome-shown') === '1') {
      setVisible(false)
      return
    }

    sessionStorage.setItem('ev0l-welcome-shown', '1')
    setVisible(true)

    const fadeTimer = window.setTimeout(() => {
      setLeaving(true)
    }, 2200)

    const hideTimer = window.setTimeout(() => {
      setVisible(false)
    }, 3000)

    return () => {
      window.clearTimeout(fadeTimer)
      window.clearTimeout(hideTimer)
    }
  }, [])

  if (!visible || item == null) return null

function resume() {
    if (!item!.mediaId) return

    if (
      item!.type === 'series' &&
      item!.season &&
      item!.episode
    ) {
      navigate(
        `/watch/series/${item!.mediaId}/${item!.season}/${item!.episode}`,
      )
      return
    }

    navigate(`/watch/movie/${item!.mediaId}`)
  }

  return (
    <div
      className={`ev0l-welcome${leaving ? ' ev0l-welcome--leaving' : ''}`}
    >
      <div className="ev0l-welcome__glow" />

      <div className="ev0l-welcome__content">
        <span className="eyebrow">EV0L</span>

        <h1>Welcome back</h1>

        <p>Ready to pick up where you left off?</p>

        <button
          type="button"
          className="ev0l-welcome__resume"
          onClick={resume}
        >
{item!.poster && (
            <img src={item!.poster} alt="" />
          )}

          <span>
            <small>Continue Watching</small>

            <strong>{item!.name}</strong>

            {item!.type === 'series' && (
              <em>
                Season {item!.season}  Episode {item!.episode}
              </em>
            )}
          </span>
        </button>
      </div>
    </div>
  )
}

