import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const MENU = ['Home', 'Movies', 'Series', 'Live TV', 'Settings'] as const
type MenuItem = (typeof MENU)[number]

function App() {
  const [selected, setSelected] = useState<MenuItem>('Home')
  const [focus, setFocus] = useState(0)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key
      if (key === 'ArrowLeft' || key === 'ArrowUp') {
        setFocus((value) => Math.max(0, value - 1))
        event.preventDefault()
      }
      if (key === 'ArrowRight' || key === 'ArrowDown') {
        setFocus((value) => Math.min(MENU.length - 1, value + 1))
        event.preventDefault()
      }
      if (key === 'Enter') {
        setSelected(MENU[focus])
        event.preventDefault()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [focus])

  return (
    <main className="tv-app">
      <header className="tv-header">
        <div>
          <span className="eyebrow">EV0L TV</span>
          <h1>{selected}</h1>
        </div>
        <span className="status">Tizen foundation</span>
      </header>

      <nav className="tv-nav" aria-label="EV0L TV navigation">
        {MENU.map((item, index) => (
          <button
            key={item}
            className={index === focus ? 'tv-nav-item focused' : 'tv-nav-item'}
            onClick={() => {
              setFocus(index)
              setSelected(item)
            }}
          >
            {item}
          </button>
        ))}
      </nav>

      <section className="tv-panel">
        {selected === 'Home' && (
          <>
            <p className="lead">A clean Samsung TV shell, isolated from the Windows EV0L application.</p>
            <div className="tile-row">
              <article><strong>Stalker Portal</strong><span>IPTV source adapter</span></article>
              <article><strong>Native Player</strong><span>TV-first media playback</span></article>
              <article><strong>EV0L LAN</strong><span>Optional shared backend</span></article>
            </div>
          </>
        )}

        {selected !== 'Home' && <p className="lead">{selected} is the next Tizen subsystem to implement.</p>}
      </section>

      <footer className="tv-footer">Arrow keys to navigate · Enter to select</footer>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
)
