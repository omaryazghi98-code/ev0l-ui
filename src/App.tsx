import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useNavigate,
  useParams,
} from 'react-router-dom'
import './App.css'

const CINEMETA = 'https://v3-cinemeta.strem.io'
const API_BASE = `${window.location.protocol}//${window.location.hostname}:11470`

type Meta = {
  id: string
  type: 'movie' | 'series'
  name: string
  poster?: string
  background?: string
  description?: string
  year?: string
  imdbRating?: string
  genres?: string[]
  cast?: string[]
  videos?: Episode[]
}

type Episode = {
  id: string
  name: string
  season: number
  episode: number
  thumbnail?: string
  overview?: string
  rating?: string
}

type SearchFilter = 'all' | 'movie' | 'series'

const RECENT_SEARCHES_KEY = 'ev0l-recent-searches'

const PROFILE_KEY = 'ev0l-active-profile'

const THEME_KEY = 'ev0l-theme'

type Theme = 'dark' | 'light'

function getTheme(): Theme {
  return localStorage.getItem(THEME_KEY) === 'light'
    ? 'light'
    : 'dark'
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  localStorage.setItem(THEME_KEY, theme)
}
const PROFILES_KEY = 'ev0l-profiles'

type Profile = {
  id: string
  name: string
  avatar?: string
}

const DEFAULT_PROFILES: Profile[] = [
  { id: 'omar', name: 'Omar', avatar: 'O' },
  { id: 'guest-1', name: 'Guest', avatar: 'G' },
]

function loadProfiles(): Profile[] {
  try {
    const saved = localStorage.getItem(PROFILES_KEY)
    if (saved) return JSON.parse(saved) as Profile[]
  } catch {
    // fall back to defaults
  }

  localStorage.setItem(
    PROFILES_KEY,
    JSON.stringify(DEFAULT_PROFILES),
  )

  return DEFAULT_PROFILES
}

function getActiveProfileId(): string | null {
  return localStorage.getItem(PROFILE_KEY)
}

function setActiveProfileId(id: string) {
  localStorage.setItem(PROFILE_KEY, id)
}


type LibraryItem = {
  id: number
  type: 'movie' | 'series'
  mediaId: string
  name: string
  poster?: string
  season?: number
  episode?: number
  position: number
  duration: number
  watchedAt?: string
  updatedAt?: string
}

async function getCatalog(type: 'movie' | 'series'): Promise<Meta[]> {
  const response = await fetch(`${CINEMETA}/catalog/${type}/top.json`)

  if (!response.ok) {
    throw new Error(`Catalogue request failed: ${response.status}`)
  }

  const data = await response.json()
  return data.metas ?? []
}

async function getMeta(
  type: 'movie' | 'series',
  id: string,
): Promise<Meta> {
  const response = await fetch(`${CINEMETA}/meta/${type}/${id}.json`)

  if (!response.ok) {
    throw new Error(`Metadata request failed: ${response.status}`)
  }

  const data = await response.json()
  return data.meta
}

async function getWatchlist(): Promise<LibraryItem[]> {
  const response = await fetch(`${API_BASE}/library/watchlist`)

  if (!response.ok) {
    throw new Error(`Watchlist request failed: ${response.status}`)
  }

  const data = await response.json()
  return data.items ?? []
}

async function addToWatchlist(meta: Meta) {
  const response = await fetch(`${API_BASE}/library/watchlist`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: meta.type,
      mediaId: meta.id,
      name: meta.name,
      poster: meta.poster ?? '',
    }),
  })

  if (!response.ok) {
    throw new Error(`Add to watchlist failed: ${response.status}`)
  }
}


async function getHistory(): Promise<LibraryItem[]> {
  const response = await fetch(`${API_BASE}/library/history`)

  if (!response.ok) {
    throw new Error(`History request failed: ${response.status}`)
  }

  const data = await response.json()
  return data.items ?? []
}

async function saveProgress(item: {
  type: 'movie' | 'series'
  mediaId: string
  name: string
  poster?: string
  season?: number
  episode?: number
  position?: number
  duration?: number
}) {
  const response = await fetch(`${API_BASE}/library/history`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: item.type,
      mediaId: item.mediaId,
      name: item.name,
      poster: item.poster ?? '',
      season: item.season ?? 0,
      episode: item.episode ?? 0,
      position: item.position ?? 0,
      duration: item.duration ?? 0,
    }),
  })

  if (!response.ok) {
    throw new Error(`Save history failed: ${response.status}`)
  }
}

async function removeFromWatchlist(type: string, id: string) {
  const response = await fetch(
    `${API_BASE}/library/watchlist/${encodeURIComponent(type)}/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    },
  )

  if (!response.ok) {
    throw new Error(`Remove from watchlist failed: ${response.status}`)
  }
}


function ProfilePicker({
  onSelect,
}: {
  onSelect: (profile: Profile) => void
}) {
  const [profiles, setProfiles] = useState<Profile[]>(loadProfiles())

  function addGuest() {
    const number =
      profiles.filter((profile) => profile.id.startsWith('guest')).length + 1

    const profile: Profile = {
      id: `guest-${Date.now()}`,
      name: `Guest ${number}`,
      avatar: 'G',
    }

    const next = [...profiles, profile]
    setProfiles(next)
    localStorage.setItem(PROFILES_KEY, JSON.stringify(next))
  }

  return (
    <div className="profile-screen">
      <div className="profile-panel">
        <span className="eyebrow">EV0L</span>
        <h1>Who's watching?</h1>

        <div className="profiles">
          {profiles.map((profile) => (
            <button
              className="profile-card"
              key={profile.id}
              onClick={() => onSelect(profile)}
            >
              <span className="profile-avatar">
                {profile.avatar ?? profile.name[0]}
              </span>
              <strong>{profile.name}</strong>
            </button>
          ))}
        </div>

        <button
          className="secondary-button"
          onClick={addGuest}
        >
          + Add Guest
        </button>
      </div>
    </div>
  )
}

function Header() {
  return (
    <header className="topbar">
      <Link className="brand" to="/">
        EV0L
      </Link>

      <nav>
        <Link to="/">Home</Link>
        <Link to="/movies">Movies</Link>
        <Link to="/series">Series</Link>
        <Link to="/iptv">IPTV</Link>
        <Link className="nav-search" to="/search">Search</Link>
        <Link to="/my-list">My List</Link>
      </nav>
    </header>
  )
}

function Card({ meta }: { meta: Meta }) {
  return (
    <Link className="card" to={`/title/${meta.type}/${meta.id}`}>
      <div className="poster">
        {meta.poster ? (
          <img src={meta.poster} alt={meta.name} loading="lazy" />
        ) : (
          <span>No poster</span>
        )}
      </div>

      <h3>{meta.name}</h3>

      <span className="card-meta">
        {meta.year ?? ''}
        {meta.imdbRating ? `   ${meta.imdbRating}` : ''}
      </span>
    </Link>
  )
}

function CardRow({
  title,
  metas,
  link,
}: {
  title: string
  metas: Meta[]
  link: string
}) {
  return (
    <section className="catalog-row">
      <div className="row-heading">
        <h2>{title}</h2>
        <Link to={link}>See all</Link>
      </div>

      <div className="cards">
        {metas.slice(0, 10).map((meta) => (
          <Card key={meta.id} meta={meta} />
        ))}
      </div>
    </section>
  )
}

function Home() {
  const [movies, setMovies] = useState<Meta[]>([])
  const [series, setSeries] = useState<Meta[]>([])
  const [history, setHistory] = useState<LibraryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getCatalog('movie'),
      getCatalog('series'),
      getHistory(),
    ])
      .then(([movieData, seriesData, historyData]) => {
        setMovies(movieData)
        setSeries(seriesData)
        setHistory(historyData)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="status">Loading EV0L catalogue...</div>
  }

  return (
    <>
      {history.length > 0 && (
        <section className="catalog-row continue-watching">
          <div className="row-heading">
            <h2>Continue Watching</h2>
          </div>

          <div className="cards">
            {history.slice(0, 10).map((item) => (
              <Link
                className="card"
                key={`${item.type}-${item.mediaId}-${item.season ?? 0}-${item.episode ?? 0}`}
                to={
                  item.type === 'series' && item.season && item.episode
                    ? `/watch/series/${item.mediaId}/${item.season}/${item.episode}`
                    : `/watch/movie/${item.mediaId}`
                }
              >
                <div className="poster">
                  {item.poster ? (
                    <img src={item.poster} alt={item.name} loading="lazy" />
                  ) : (
                    <span>No poster</span>
                  )}
                </div>

                <h3>{item.name}</h3>

                {item.type === 'series' && item.season && item.episode ? (
                  <span className="card-meta">
                    S{item.season} E{item.episode}
                  </span>
                ) : (
                  <span className="card-meta">Resume</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="hero">
        <div className="hero-content">
          <span className="eyebrow">EV0L STREAM</span>
          <h1>Your entertainment.<br />Your server.</h1>
          <p>
            Discover movies and series, then find available streams
            through your own server.
          </p>

          <Link className="primary-button" to="/movies">
            Explore
          </Link>
        </div>
      </section>

      <CardRow title="Popular Movies" metas={movies} link="/movies" />
      <CardRow title="Popular Series" metas={series} link="/series" />
    </>
  )
}

function Listing({ type }: { type: 'movie' | 'series' }) {
  const [metas, setMetas] = useState<Meta[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCatalog(type)
      .then(setMetas)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [type])

  return (
    <section className="page">
      <div className="page-heading">
        <span className="eyebrow">CATALOGUE</span>
        <h1>{type === 'movie' ? 'Movies' : 'Series'}</h1>
      </div>

      {loading ? (
        <div className="status">Loading...</div>
      ) : (
        <div className="cards full-grid">
          {metas.map((meta) => (
            <Card key={meta.id} meta={meta} />
          ))}
        </div>
      )}
    </section>
  )
}

function SeasonEpisodes({ meta }: { meta: Meta }) {
  const seasons = Array.from(new Set((meta.videos ?? []).map((episode) => episode.season))).sort((a, b) => a - b)
  const storageKey = `ev0l-season-${meta.id}`
  const [selectedSeason, setSelectedSeason] = useState(() => Number(sessionStorage.getItem(storageKey)) || seasons[0] || 1)
  const episodes = (meta.videos ?? []).filter((episode) => episode.season === selectedSeason)

  return (
    <section className="episodes">
      <div className="season-heading">
        <h2>Episodes</h2>
        <label>
          Season
          <select value={selectedSeason} onChange={(event) => { const season = Number(event.target.value); setSelectedSeason(season); sessionStorage.setItem(storageKey, String(season)) }}>
            {seasons.map((season) => <option key={season} value={season}>{season}</option>)}
          </select>
        </label>
      </div>
      {episodes.map((episode) => (
        <Link className="episode" key={episode.id} to={`/watch/series/${meta.id}/${episode.season}/${episode.episode}`}>
          {episode.thumbnail && <img src={episode.thumbnail} alt="" />}
          <div><strong>S{episode.season} E{episode.episode} {episode.name}</strong>{episode.rating && <span> {episode.rating}</span>}{episode.overview && <p>{episode.overview}</p>}</div>
        </Link>
      ))}
    </section>
  )
}
function TitlePage() {
  const { type, id } = useParams<{
    type: 'movie' | 'series'
    id: string
  }>()

  const navigate = useNavigate()
  const [meta, setMeta] = useState<Meta | null>(null)
  const [loading, setLoading] = useState(true)
  const [inWatchlist, setInWatchlist] = useState(false)
  const [watchlistBusy, setWatchlistBusy] = useState(false)

  useEffect(() => {
    if (!type || !id) return

    getMeta(type, id)
      .then(setMeta)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [type, id])

  useEffect(() => {
    if (!meta) return

    getWatchlist()
      .then((items) => {
        setInWatchlist(
          items.some(
            (item) =>
              item.type === meta.type &&
              item.mediaId === meta.id,
          ),
        )
      })
      .catch(console.error)
  }, [meta])

  async function toggleWatchlist() {
    if (!meta || watchlistBusy) return

    setWatchlistBusy(true)

    try {
      if (inWatchlist) {
        await removeFromWatchlist(meta.type, meta.id)
        setInWatchlist(false)
      } else {
        await addToWatchlist(meta)
        setInWatchlist(true)
      }
    } catch (error) {
      console.error(error)
      alert('Could not update My List.')
    } finally {
      setWatchlistBusy(false)
    }
  }

  if (loading) {
    return <div className="status">Loading title...</div>
  }

  if (!meta) {
    return <div className="status error">Title not found.</div>
  }

  return (
    <div
      className="detail"
      style={{
        backgroundImage: meta.background
          ? `linear-gradient(to bottom, rgba(8,8,8,.1), #080808 80%), url(${meta.background})`
          : undefined,
      }}
    >
      <button className="back" onClick={() => navigate(-1)}>
         Back
      </button>

      <section className="detail-content">
        <div className="detail-poster">
          {meta.poster && <img src={meta.poster} alt={meta.name} />}
        </div>

        <div className="info">
          <span className="eyebrow">
            {meta.type === 'movie' ? 'MOVIE' : 'SERIES'}
          </span>

          <h1>{meta.name}</h1>

          <div className="meta">
            {meta.year && <span>{meta.year}</span>}
            {meta.imdbRating && <span> {meta.imdbRating}</span>}
            {meta.genres?.map((genre) => (
              <span key={genre}>{genre}</span>
            ))}
          </div>

          <p>{meta.description}</p>

          {meta.cast && meta.cast.length > 0 && (
            <p className="cast">
              <strong>Cast:</strong> {meta.cast.join(', ')}
            </p>
          )}

          {meta.type === 'movie' && (
            <div className="action-buttons">
              <Link
                className="primary-button"
                to={`/watch/movie/${meta.id}`}
              >
                 Watch
              </Link>

              <button
                className="secondary-button"
                onClick={() =>
                  alert(
                    'Download source is not available yet. We need a permitted direct media URL from the provider.',
                  )
                }
              >
                 Download
              </button>

              <button
                className="secondary-button"
                onClick={toggleWatchlist}
                disabled={watchlistBusy}
              >
                {watchlistBusy
                  ? 'Saving...'
                  : inWatchlist
                    ? ' My List'
                    : '+ My List'}
              </button>

              <button
                className="secondary-button"
                onClick={toggleWatchlist}
                disabled={watchlistBusy}
              >
                {watchlistBusy
                  ? 'Saving...'
                  : inWatchlist
                    ? ' My List'
                    : '+ My List'}
              </button>
            </div>
          )}

          {meta.type === 'series' && (
            <div className="action-buttons">
              <button
                className="secondary-button"
                onClick={toggleWatchlist}
                disabled={watchlistBusy}
              >
                {watchlistBusy
                  ? 'Saving...'
                  : inWatchlist
                    ? ' My List'
                    : '+ My List'}
              </button>
            </div>
          )}
        </div>
      </section>

      {meta.type === 'series' && <SeasonEpisodes meta={meta} />}\r\n    </div>
  )
}

function MyList() {
  const [items, setItems] = useState<LibraryItem[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      setItems(await getWatchlist())
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function remove(item: LibraryItem) {
    try {
      await removeFromWatchlist(item.type, item.mediaId)
      setItems((current) =>
        current.filter(
          (entry) =>
            !(
              entry.type === item.type &&
              entry.mediaId === item.mediaId
            ),
        ),
      )
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <section className="page">
      <div className="page-heading">
        <span className="eyebrow">YOUR LIBRARY</span>
        <h1>My List</h1>
      </div>

      {loading ? (
        <div className="status">Loading your list...</div>
      ) : items.length === 0 ? (
        <div className="status">
          Your list is empty. Add something you want to watch.
        </div>
      ) : (
        <div className="cards full-grid">
          {items.map((item) => (
            <div className="library-card" key={`${item.type}-${item.mediaId}`}>
              <Link
                className="card"
                to={`/title/${item.type}/${item.mediaId}`}
              >
                <div className="poster">
                  {item.poster ? (
                    <img
                      src={item.poster}
                      alt={item.name}
                      loading="lazy"
                    />
                  ) : (
                    <span>No poster</span>
                  )}
                </div>

                <h3>{item.name}</h3>

                <span className="card-meta">
                  {item.type === 'movie' ? 'Movie' : 'Series'}
                </span>
              </Link>

              <button
                className="remove-list-button"
                onClick={() => remove(item)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function Watch() {
  const { type, id, season, episode } = useParams<{
    type: 'movie' | 'series'
    id: string
    season?: string
    episode?: string
  }>()

  const navigate = useNavigate()
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!type || !id) return

    void getMeta(type, id)
      .then((meta) => {
        void saveProgress({
          type,
          mediaId: id,
          name: meta.name,
          poster: meta.poster,
          season: season ? Number(season) : 0,
          episode: episode ? Number(episode) : 0,
        })
      })
      .catch(console.error)
  }, [type, id, season, episode])
  const [simklWatched, setSimklWatched] = useState(false)
  const [simklBusy, setSimklBusy] = useState(false)

  async function markEpisodeWatched() {
    if (type !== 'series' || !id || !season || !episode || simklBusy) {
      return
    }

    setSimklBusy(true)

    try {
      const response = await fetch(`${API_BASE}/simkl/episode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mediaId: id,
          season: Number(season),
          episode: Number(episode),
        }),
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      setSimklWatched(true)
    } catch (error) {
      console.error(error)
      alert('Could not sync this episode to Simkl.')
    } finally {
      setSimklBusy(false)
    }
  }

  if (!type || !id) {
    return <div className="status error">Invalid stream.</div>
  }

  const src =
    type === 'movie'
      ? `https://vidsrc.to/embed/movie/${id}`
      : `https://vidsrc.to/embed/tv/${id}/${season}/${episode}`

  return (
    <section className="watch-page">
      <div className="watch-topbar">
        <button className="back" onClick={() => navigate(-1)}>
           Back
        </button>

        <span>EV0L PLAYER</span>
      </div>

      {type === 'series' && (
        <div className="action-buttons">
          <button
            className="secondary-button"
            onClick={() => void markEpisodeWatched()}
            disabled={simklBusy || simklWatched}
          >
            {simklWatched
              ? ' Synced to Simkl'
              : simklBusy
                ? 'Syncing...'
                : 'Mark watched'}
          </button>
        </div>
      )}

      <div className="player">
        {!loaded && (
          <div className="player-loading">
            Loading player...
          </div>
        )}

        <iframe
          src={src}
          title="EV0L Player"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          onLoad={() => setLoaded(true)}
        />
      </div>

      <p className="player-note">
        Temporary external playback source.
      </p>
    </section>
  )
}

function Search() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Meta[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<SearchFilter>('all')
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState(false)
  const requestId = useRef(0)

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) ?? '[]')
      if (Array.isArray(stored)) {
        setRecentSearches(
          stored
            .filter((entry): entry is string => typeof entry === 'string')
            .slice(0, 8),
        )
      }
    } catch {
      localStorage.removeItem(RECENT_SEARCHES_KEY)
    }
  }, [])

  function saveRecentSearch(value: string) {
    const normalized = value.trim()
    if (normalized.length < 2) return

    setRecentSearches((current) => {
      const next = [
        normalized,
        ...current.filter(
          (entry) => entry.toLowerCase() !== normalized.toLowerCase(),
        ),
      ].slice(0, 8)
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next))
      return next
    })
  }

  async function search(value: string, nextFilter = filter) {
    const normalized = value.trim()
    const currentRequest = ++requestId.current

    if (normalized.length < 2) {
      setResults([])
      setLoading(false)
      setHasSearched(false)
      setError(false)
      return
    }

    setLoading(true)
    setHasSearched(true)
    setError(false)

    try {
      const searchTypes: Array<'movie' | 'series'> =
        nextFilter === 'all' ? ['movie', 'series'] : [nextFilter]
      const searchResults = await Promise.all(
        searchTypes.map(async (type) => {
          const response = await fetch(
            `${CINEMETA}/catalog/${type}/top/search=${encodeURIComponent(normalized)}.json`,
          )
          if (!response.ok) {
            throw new Error(`Search request failed: ${response.status}`)
          }

          const data = await response.json()
          return (data.metas ?? []) as Meta[]
        }),
      )
      if (currentRequest !== requestId.current) return

      setResults(searchResults.flat())
      saveRecentSearch(normalized)
    } catch (searchError) {
      if (currentRequest !== requestId.current) return
      console.error(searchError)
      setResults([])
      setError(true)
    } finally {
      if (currentRequest === requestId.current) setLoading(false)
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void search(query)
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [query, filter])

  function clearSearch() {
    requestId.current += 1
    setQuery('')
    setResults([])
    setHasSearched(false)
    setError(false)
    setLoading(false)
  }

  return (
    <section className="page search-page">
      <div className="page-heading">
        <span className="eyebrow">DISCOVER</span>
        <h1>Search</h1>
      </div>

      <input
        className="search-input"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            void search(query)
          }
          if (event.key === 'Escape') clearSearch()
        }}
        placeholder="Search movies and series..."
        autoFocus
      />

      <div className="search-filters" aria-label="Search filter">
        {(['all', 'movie', 'series'] as SearchFilter[]).map((option) => (
          <button
            className={filter === option ? 'active' : ''}
            key={option}
            onClick={() => setFilter(option)}
          >
            {option === 'all'
              ? 'All'
              : option === 'movie'
                ? 'Movies'
                : 'Series'}
          </button>
        ))}
      </div>

      {recentSearches.length > 0 && !query && (
        <section className="recent-searches">
          <h2>Recent searches</h2>
          <div>
            {recentSearches.map((recent) => (
              <button
                key={recent}
                onClick={() => {
                  setQuery(recent)
                  void search(recent)
                }}
              >
                {recent}
              </button>
            ))}
          </div>
        </section>
      )}

      {loading && (
        <div className="status search-status">Searching EV0L catalogue...</div>
      )}

      {!loading && error && (
        <div className="status error search-status">
          Search is unavailable right now. Please try again.
        </div>
      )}

      {!loading && !error && !hasSearched && query.trim().length < 2 && (
        <div className="status search-status">
          Start typing a movie or series title. Press Enter to search now, or
          Escape to clear.
        </div>
      )}

      {!loading && !error && hasSearched && results.length === 0 && (
        <div className="status search-status">
          No {filter === 'all' ? 'titles' : filter === 'movie' ? 'movies' : 'series'}
          {' '}found for “{query.trim()}”. Try another search.
        </div>
      )}

      {results.length > 0 && (
        <div className="cards full-grid search-results">
          {results.map((meta) => (
            <Card key={`${meta.type}-${meta.id}`} meta={meta} />
          ))}
        </div>
      )}
    </section>
  )
}
type IPTVChannel = {
  id: string
  name: string
  url: string
  logo?: string
  group: string
  tvgId?: string
  tvgName?: string
}

type IPTVPlaylist = {
  name: string
  channels: IPTVChannel[]
}

const IPTV_KEY = 'ev0l-iptv'

const EPG_KEY = 'ev0l-epg'

const LOGO_CACHE_KEY = 'ev0l-channel-logos'
const LOGO_API = 'https://iptv-org.github.io/api/logos.json'

type LogoRecord = {
  channel: string
  feed?: string | null
  in_use?: boolean
  url: string
}

function normalizeChannelName(value: string) {
  return value
    .toLowerCase()
    .replace(/\b(uhd|4k|fhd|hd|sd|hevc|h265|h\.265)\b/gi, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function getCachedLogos(): Record<string, string> {
  try {
    return JSON.parse(
      localStorage.getItem(LOGO_CACHE_KEY) || '{}',
    ) as Record<string, string>
  } catch {
    return {}
  }
}

async function buildLogoIndex(): Promise<Record<string, string>> {
  const response = await fetch(LOGO_API)

  if (!response.ok) {
    throw new Error(`Logo API returned ${response.status}`)
  }

  const records = (await response.json()) as LogoRecord[]
  const index: Record<string, string> = {}

  for (const record of records) {
    if (!record.url || record.in_use === false) continue

    const key = record.channel.trim().toLowerCase()

    if (!index[key]) {
      index[key] = record.url
    }
  }

  return index
}

async function resolveChannelLogos(
  channels: IPTVChannel[],
): Promise<IPTVChannel[]> {
  const cached = getCachedLogos()
  let index: Record<string, string> = cached

  try {
    const remote = await buildLogoIndex()
    index = { ...cached, ...remote }
    localStorage.setItem(LOGO_CACHE_KEY, JSON.stringify(index))
  } catch {
    // Keep cached logos when the remote service is unavailable.
  }

  return channels.map((channel) => {
    if (channel.logo) return channel

    const normalized = normalizeChannelName(channel.name)

    const direct =
      index[channel.name.toLowerCase()] ||
      Object.entries(index).find(([key]) => {
        return (
          normalizeChannelName(key) === normalized ||
          normalizeChannelName(key).includes(normalized) ||
          normalized.includes(normalizeChannelName(key))
        )
      })?.[1]

    return direct
      ? { ...channel, logo: direct }
      : channel
  })
}

type EPGChannel = {
  id: string
  displayName: string
  icon?: string
}

type EPGProgram = {
  channelId: string
  start: string
  stop: string
  title: string
  description?: string
}

type EPGData = {
  channels: Record<string, EPGChannel>
  programs: EPGProgram[]
}

function parseXMLTV(text: string): EPGData {
  const parser = new DOMParser()
  const xml = parser.parseFromString(text, 'text/xml')

  const channels: Record<string, EPGChannel> = {}
  const programs: EPGProgram[] = []

  for (const node of Array.from(xml.querySelectorAll('channel'))) {
    const id = node.getAttribute('id')?.trim()
    if (!id) continue

    const name =
      node.querySelector('display-name')?.textContent?.trim() || id

    const icon = node.querySelector('icon')?.getAttribute('src') || undefined

    channels[id] = {
      id,
      displayName: name,
      icon,
    }
  }

  for (const node of Array.from(xml.querySelectorAll('programme'))) {
    const channelId = node.getAttribute('channel')?.trim()
    const start = node.getAttribute('start')?.trim()
    const stop = node.getAttribute('stop')?.trim()
    const title = node.querySelector('title')?.textContent?.trim()

    if (!channelId || !start || !stop || !title) continue

    programs.push({
      channelId,
      start,
      stop,
      title,
      description:
        node.querySelector('desc')?.textContent?.trim() || undefined,
    })
  }

  return { channels, programs }
}

function parseM3U(text: string) {
  const channels: IPTVChannel[] = []
  let info = ''
  let skipped = 0

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()

    if (line.startsWith('#EXTINF:')) {
      info = line
      continue
    }

    if (!line || line.startsWith('#')) {
      continue
    }

    if (!info || !/^https?:\/\//i.test(line)) {
      skipped += info ? 1 : 0
      info = ''
      continue
    }

    const attr = (key: string) =>
      info.match(new RegExp(`${key}="([^"]*)"`, 'i'))?.[1]

    const displayName =
      info.split(',').slice(1).join(',').trim() ||
      attr('tvg-name') ||
      'Unknown channel'

    channels.push({
      id: `${Date.now()}-${channels.length}`,
      name: displayName,
      url: line,
      logo: attr('tvg-logo'),
      group: attr('group-title') || 'Other',
      tvgId: attr('tvg-id'),
      tvgName: attr('tvg-name'),
    })

    info = ''
  }

  return { channels, skipped }
}
function IPTV() {
  const [playlist, setPlaylist] = useState<IPTVPlaylist | null>(() => {
    try {
      return JSON.parse(
        localStorage.getItem(IPTV_KEY) || 'null',
      ) as IPTVPlaylist | null
    } catch {
      return null
    }
  })

  const [query, setQuery] = useState('')
  const [activeGroup, setActiveGroup] = useState('All')
  const [message, setMessage] = useState('')
  const input = useRef<HTMLInputElement>(null)

  const save = async (text: string, name: string) => {
    const result = parseM3U(text)

    if (!result.channels.length) {
      setMessage('No valid channels found.')
      return
    }

    setMessage(
      `Imported ${result.channels.length} channels. Looking up logos...`,
    )

    const channels = await resolveChannelLogos(result.channels)

    const next: IPTVPlaylist = {
      name,
      channels,
    }

    setPlaylist(next)
    localStorage.setItem(IPTV_KEY, JSON.stringify(next))

    const logoCount = channels.filter((channel) => channel.logo).length

    setMessage(
      `Imported ${channels.length} channels  ${logoCount} logos found  skipped ${result.skipped}.`,
    )
  }

  const groups = [
    'All',
    ...Array.from(
      new Set((playlist?.channels ?? []).map((channel) => channel.group)),
    ).sort(),
  ]

  const channels =
    playlist?.channels.filter((channel) => {
      const matchesQuery = channel.name
        .toLowerCase()
        .includes(query.toLowerCase())

      const matchesGroup =
        activeGroup === 'All' ||
        channel.group === activeGroup

      return matchesQuery && matchesGroup
    }) ?? []

  return (
    <section className="page">
      <div className="page-heading">
        <span className="eyebrow">LIVE TV</span>
        <h1>IPTV</h1>
      </div>

      <div className="action-buttons">
        <button
          className="secondary-button"
          onClick={() => input.current?.click()}
        >
          Import M3U
        </button>

        <input
          hidden
          ref={input}
          type="file"
          accept=".m3u,.m3u8"
          onChange={(event) => {
            const file = event.target.files?.[0]

            if (file) {
              void file.text().then((text) => save(text, file.name))
            }
          }}
        />

        <button
          className="secondary-button"
          onClick={() => {
            const url = prompt('M3U playlist URL')

            if (url) {
              void fetch(url)
                .then((response) => {
                  if (!response.ok) {
                    throw new Error('Playlist request failed')
                  }
                  return response.text()
                })
                .then((text) => save(text, url))
                .catch(() => {
                  setMessage('Could not import URL.')
                })
            }
          }}
        >
          Add URL
        </button>

        <button
          className="secondary-button"
          onClick={() => {
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = '.xml,.xmltv'

            input.onchange = () => {
              const file = input.files?.[0]
              if (!file) return

              void file.text().then((text) => {
                const epg = parseXMLTV(text)

                localStorage.setItem(
                  EPG_KEY,
                  JSON.stringify(epg),
                )

                setMessage(
                  `Imported ${Object.keys(epg.channels).length} EPG channels and ${epg.programs.length} programmes.`,
                )
              })
            }

            input.click()
          }}
        >
          Import EPG
        </button>

        <button
          className="secondary-button"
          onClick={() => {
            const url = prompt('XMLTV / EPG URL')
            if (!url) return

            void fetch(url)
              .then((response) => {
                if (!response.ok) {
                  throw new Error('EPG request failed')
                }

                return response.text()
              })
              .then((text) => {
                const epg = parseXMLTV(text)

                localStorage.setItem(
                  EPG_KEY,
                  JSON.stringify(epg),
                )

                setMessage(
                  `Imported ${Object.keys(epg.channels).length} EPG channels and ${epg.programs.length} programmes.`,
                )
              })
              .catch(() => {
                setMessage('Could not import EPG.')
              })
          }}
        >
          Add EPG URL
        </button>

        {playlist && (
          <button
            className="secondary-button"
            onClick={() => {
              setPlaylist(null)
              localStorage.removeItem(IPTV_KEY)
              setQuery('')
              setActiveGroup('All')
            }}
          >
            Clear IPTV data
          </button>
        )}
      </div>

      {message && <p className="status">{message}</p>}

      {playlist && (
        <>
          <div className="iptv-toolbar">
            <div>
              <strong>{playlist.name}</strong>
              <small>{playlist.channels.length} channels</small>
            </div>

            <input
              className="search-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search channels..."
            />
          </div>

          <div className="iptv-groups">
            {groups.map((group) => (
              <button
                key={group}
                className={
                  group === activeGroup
                    ? 'iptv-group active'
                    : 'iptv-group'
                }
                onClick={() => setActiveGroup(group)}
              >
                {group}
              </button>
            ))}
          </div>

          <div className="iptv-grid">
            {channels.map((channel) => (
              <Link
                className="iptv-card"
                key={channel.id}
                to={`/iptv/watch/${channel.id}`}
              >
                <div className="iptv-card-logo">
                  {channel.logo ? (
                    <img
                      src={channel.logo}
                      alt=""
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none'
                      }}
                    />
                  ) : (
                    <span className="iptv-logo-fallback">
                      {channel.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="iptv-card-info">
                  <strong>{channel.name}</strong>
                  <small>
                    {channel.group}
                    {channel.tvgId ? `  ${channel.tvgId}` : ''}
                  </small>
                </div>

                <span className="iptv-live-dot">LIVE</span>
              </Link>
            ))}
          </div>

          {!channels.length && (
            <div className="status">
              No channels match your filters.
            </div>
          )}
        </>
      )}
    </section>
  )
}

function HLSVideo({ src, name }: { src: string; name: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')
  useEffect(() => { const video = ref.current; if (!video) return; if (video.canPlayType('application/vnd.apple.mpegurl')) { video.src = src; return }; if (!Hls.isSupported()) { setError('This browser cannot play HLS streams.'); return }; const hls = new Hls(); hls.loadSource(src); hls.attachMedia(video); hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) setError('Stream unavailable or blocked by its provider.') }); return () => hls.destroy() }, [src])
  return <>{error ? <div className="player-loading">{error}</div> : <video ref={ref} controls autoPlay playsInline onError={() => setError('This stream could not be played.')} title={name} />}</>
}
function IPTVWatch() {
  const { channelId } = useParams<{ channelId: string }>()
  const navigate = useNavigate()

  let playlist: IPTVPlaylist | null = null

  try {
    playlist = JSON.parse(
      localStorage.getItem(IPTV_KEY) || 'null',
    ) as IPTVPlaylist | null
  } catch {
    playlist = null
  }

  const channel = playlist?.channels.find(
    (item) => item.id === channelId,
  )

  if (!channel) {
    return (
      <div className="status error">
        Channel not found.
      </div>
    )
  }

  const sessionId = encodeURIComponent(channel.id)

  const streamURL =
    `${API_BASE}/iptv/hls/${sessionId}/index.m3u8` +
    `?mediaURL=${encodeURIComponent(channel.url)}`

  return (
    <section className="watch-page">
      <div className="watch-topbar">
        <button
          className="back"
          onClick={() => navigate('/iptv')}
        >
          Back to IPTV
        </button>

        <span>{channel.name}</span>
      </div>

      <div className="player">
        <HLSVideo
          src={streamURL}
          name={channel.name}
        />
      </div>

      <div className="iptv-now-playing">
        {channel.logo && (
          <img
            src={channel.logo}
            alt=""
          />
        )}

        <div>
          <strong>{channel.name}</strong>
          <small>{channel.group}</small>
        </div>
      </div>
    </section>
  )
}

function App() {
  const [profileId, setProfileId] = useState<string | null>(
    getActiveProfileId(),
  )

  useEffect(() => {
    applyTheme(getTheme())
  }, [])

  function selectProfile(profile: Profile) {
    setActiveProfileId(profile.id)
    setProfileId(profile.id)
  }

  if (!profileId) {
    return <ProfilePicker onSelect={selectProfile} />
  }

  return (
    <BrowserRouter>
      <div className="app">
        <Header />

        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/movies" element={<Listing type="movie" />} />
            <Route path="/series" element={<Listing type="series" />} />
            <Route path="/search" element={<Search />} />`n            <Route path="/iptv" element={<IPTV />} />`n            <Route path="/iptv/watch/:channelId" element={<IPTVWatch />} />
            <Route path="/my-list" element={<MyList />} />
            <Route path="/title/:type/:id" element={<TitlePage />} />
            <Route
              path="/watch/:type/:id"
              element={<Watch />}
            />
            <Route
              path="/watch/:type/:id/:season/:episode"
              element={<Watch />}
            />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App


