import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { itemPath, mediaPath, type Episode, type LibraryItem, type Meta } from '../lib/ev0l'

const icons: Record<string, ReactNode> = {
  home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10.5V20h14v-9.5M9 20v-6h6v6"/></>,
  film: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h4m10 0h4M3 15h4m10 0h4"/></>,
  tv: <><rect x="3" y="6" width="18" height="14" rx="2"/><path d="m8 2 4 4 4-4"/></>,
  live: <><path d="M8.5 8.5a5 5 0 0 0 0 7M5 5a10 10 0 0 0 0 14M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/><circle cx="12" cy="12" r="2"/></>,
  bookmark: <path d="M6 3h12v18l-6-4-6 4z"/>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
  moon: <path d="M21 15a9 9 0 1 1-12-12 7 7 0 0 0 12 12z"/>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  check: <path d="m5 12 4 4L19 6"/>,
  play: <path d="m8 5 11 7-11 7z" fill="currentColor"/>,
  arrow: <path d="m9 18 6-6-6-6"/>,
  back: <path d="m15 18-6-6 6-6"/>,
  close: <path d="m6 6 12 12M18 6 6 18"/>,
  upload: <><path d="M12 16V4m-5 5 5-5 5 5"/><path d="M4 15v5h16v-5"/></>,
  refresh: <><path d="M20 11a8 8 0 1 0-2 6"/><path d="M20 5v6h-6"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
  external: <><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v7H4V6h7"/></>,
}

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>
}
export function Brand({ compact = false }: { compact?: boolean }) {
  return <Link className="brand" to="/" aria-label="EV0L home"><span>EV</span><i>0</i><span>L</span>{!compact && <small>STREAMING</small>}</Link>
}
export function PageHeading({ eyebrow, title, detail, action }: { eyebrow?: string; title: string; detail?: string; action?: ReactNode }) {
  return <header className="page-heading"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{detail && <p>{detail}</p>}</div>{action}</header>
}
export function MediaCard({ media, index }: { media: Meta; index?: number }) {
  return <Link className="media-card" to={mediaPath(media)} aria-label={`Open ${media.name}`}>
    <div className="media-card__art">{media.poster ? <img src={media.poster} alt="" loading="lazy" /> : <div className="image-fallback">EV0L</div>}{typeof index === 'number' && <span className="media-card__rank">{index + 1}</span>}<span className="media-card__play"><Icon name="play" size={18}/></span></div>
    <div className="media-card__copy"><strong>{media.name}</strong><span>{media.year || media.releaseInfo || media.type}{media.imdbRating ? ` · ★ ${media.imdbRating}` : ''}</span></div>
  </Link>
}
export function MediaRow({ title, items, numbered = false, empty }: { title: string; items: Meta[]; numbered?: boolean; empty?: string }) {
  if (!items.length) return empty ? <EmptyState title={empty} compact /> : null
  return <section className="rail-section"><div className="section-title"><h2>{title}</h2><span>{items.length} titles</span></div><div className="media-rail">{items.map((media, index) => <MediaCard key={`${media.type}-${media.id}`} media={media} index={numbered ? index : undefined}/>)}</div></section>
}
export function ContinueCard({ item }: { item: LibraryItem }) {
  const progress = item.duration > 0 ? Math.min(100, Math.max(0, item.position / item.duration * 100)) : null
  return <Link className="continue-card" to={itemPath(item)}><div className="continue-card__art">{item.poster ? <img src={item.poster} alt="" loading="lazy"/> : <div className="image-fallback">EV0L</div>}<span className="continue-card__play"><Icon name="play"/></span>{progress !== null && <span className="progress"><i style={{ width: `${progress}%` }}/></span>}</div><div><strong>{item.name}</strong><span>{item.type === 'series' && item.season ? `S${item.season} E${item.episode || 1}` : progress !== null ? `${Math.round(progress)}% watched` : 'Continue watching'}</span></div></Link>
}
export function EpisodeCard({ episode, mediaId, state = 'unwatched' }: { episode: Episode; mediaId: string; state?: 'watched' | 'current' | 'unwatched' }) {
  return <Link className={`episode-card episode-card--${state}`} to={`/watch/series/${mediaId}/${episode.season}/${episode.episode}`}><div className="episode-card__art">{episode.thumbnail ? <img src={episode.thumbnail} alt="" loading="lazy"/> : <div className="image-fallback">S{episode.season} E{episode.episode}</div>}<span className="episode-card__play"><Icon name={state === 'watched' ? 'check' : 'play'}/></span></div><div className="episode-card__copy"><span className="episode-number">{String(episode.episode).padStart(2, '0')}</span><div><strong>{episode.name || `Episode ${episode.episode}`}</strong><p>{episode.overview || 'Episode details are not available yet.'}</p></div>{state !== 'unwatched' && <span className="episode-state">{state}</span>}</div></Link>
}
export function Skeleton({ variant = 'card', count = 1 }: { variant?: 'card' | 'hero' | 'line' | 'channel'; count?: number }) {
  return <>{Array.from({ length: count }, (_, i) => <span key={i} className={`skeleton skeleton--${variant}`} aria-hidden="true" />)}</>
}
export function ErrorState({ title = 'Something went wrong', message, retry }: { title?: string; message?: string; retry?: () => void }) {
  return <div className="state-card state-card--error"><span className="state-icon"><Icon name="info"/></span><div><h3>{title}</h3><p>{message || 'EV0L could not load this content. Check the server or your connection.'}</p></div>{retry && <button className="button button--subtle" onClick={retry}><Icon name="refresh"/>Try again</button>}</div>
}
export function EmptyState({ title, message, compact = false, action }: { title: string; message?: string; compact?: boolean; action?: ReactNode }) {
  return <div className={`state-card state-card--empty${compact ? ' state-card--compact' : ''}`}><span className="state-icon"><Icon name="film"/></span><div><h3>{title}</h3>{message && <p>{message}</p>}</div>{action}</div>
}
