import './env-loader.mjs'
import http from 'node:http'
import { URL } from 'node:url'
import { randomBytes } from 'node:crypto'
import os from 'node:os'

const PORT = Number(process.env.EVOL_API_PORT || 8090)
const HB_API_KEY = process.env.HB_API_KEY || ''
const DLHD_API_KEY = process.env.DLHD_API_KEY || ''

function json(res, status, body) {
  const payload = JSON.stringify(body)

  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })

  res.end(payload)
}

function normalise(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function namesMatch(eventName, home, away) {
  const e = normalise(eventName)
  const h = normalise(home)
  const a = normalise(away)

  if (!h || !a) return false

  const homeParts = h.split(' ').filter((x) => x.length > 2)
  const awayParts = a.split(' ').filter((x) => x.length > 2)

  const homeHit =
    e.includes(h) ||
    homeParts.some((part) => e.includes(part))

  const awayHit =
    e.includes(a) ||
    awayParts.some((part) => e.includes(part))

  return homeHit && awayHit
}

async function dlhd(endpoint) {
  if (!DLHD_API_KEY) {
    throw new Error('DLHD_API_KEY is not configured')
  }

  const url =
    `https://dlstreams.st/daddyapi.php?` +
    `key=${encodeURIComponent(DLHD_API_KEY)}` +
    `&endpoint=${encodeURIComponent(endpoint)}`

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`DLHD ${endpoint} failed: ${response.status}`)
  }

  return response.json()
}

function dlhdPlayer(channelId) {
  return `https://dlstreams.st/stream/stream-${encodeURIComponent(channelId)}.php`
}

async function handleDLHDMatch(home, away) {
  const result = await dlhd('schedule')
  const data = result?.data || {}

  const streams = []

  for (const day of Object.values(data)) {
    if (!day || typeof day !== 'object') continue

    for (const events of Object.values(day)) {
      if (!Array.isArray(events)) continue

      for (const event of events) {
        if (!namesMatch(event?.event, home, away)) continue

        const channels = [
          ...(Array.isArray(event?.channels) ? event.channels : []),
          ...(Array.isArray(event?.channels2) ? event.channels2 : []),
        ]

        for (const channel of channels) {
          if (!channel?.channel_id) continue

          streams.push({
            id: `dlhd-${channel.channel_id}`,
            name: `DLHD  ${channel.channel_name || channel.channel_id}`,
            type: 'iframe',
            url: dlhdPlayer(channel.channel_id),
          })
        }
      }
    }
  }

  return streams
}

async function createHyperbeamSession(startUrl) {
  if (!HB_API_KEY) {
    throw new Error('HB_API_KEY is not configured')
  }

  const response = await fetch(
    'https://engine.hyperbeam.com/v0/vm',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HB_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        start_url: startUrl,
        offline_timeout: 3600,
        region: 'EU',
        width: 1280,
        height: 720,
      }),
    },
  )

  const body = await response.json()

  if (!response.ok) {
    throw new Error(
      body?.message ||
      body?.error ||
      `Hyperbeam failed: ${response.status}`,
    )
  }

  return {
    session_id: body.session_id,
    embed_url: body.embed_url,
  }
}


const GUEST_INVITES_FILE = new URL(
  './guest-invites.json',
  import.meta.url,
)

async function readGuestInvites() {
  try {
    const text = await import('node:fs/promises').then((fs) =>
      fs.readFile(GUEST_INVITES_FILE, 'utf8'),
    )

    const parsed = JSON.parse(text)

    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeGuestInvites(invites) {
  const fs = await import('node:fs/promises')

  await fs.writeFile(
    GUEST_INVITES_FILE,
    JSON.stringify(invites, null, 2),
    'utf8',
  )
}

const LIBRARY_FILE = new URL(
  './data/library.json',
  import.meta.url,
)

async function readLibrary() {
  try {
    const fs = await import('node:fs/promises')
    const text = await fs.readFile(LIBRARY_FILE, 'utf8')
    const parsed = JSON.parse(text)

    return {
      watchlist: Array.isArray(parsed?.watchlist)
        ? parsed.watchlist
        : [],
      history: Array.isArray(parsed?.history)
        ? parsed.history
        : [],
    }
  } catch {
    return {
      watchlist: [],
      history: [],
    }
  }
}

async function writeLibrary(library) {
  const fs = await import('node:fs/promises')

  await fs.mkdir(new URL('./data/', import.meta.url), {
    recursive: true,
  })

  await fs.writeFile(
    LIBRARY_FILE,
    JSON.stringify(library, null, 2),
    'utf8',
  )
}

function nextLibraryId(items) {
  return (
    items.reduce(
      (max, item) =>
        typeof item?.id === 'number'
          ? Math.max(max, item.id)
          : max,
      0,
    ) + 1
  )
}

function normalizeLibraryItem(input, existingId = undefined) {
  const now = new Date().toISOString()

  return {
    id:
      typeof existingId === 'number'
        ? existingId
        : undefined,
    type: input?.type === 'series' ? 'series' : 'movie',
    mediaId: String(input?.mediaId || ''),
    name: String(input?.name || ''),
    poster:
      typeof input?.poster === 'string'
        ? input.poster
        : '',
    season:
      Number.isFinite(Number(input?.season))
        ? Number(input.season)
        : 0,
    episode:
      Number.isFinite(Number(input?.episode))
        ? Number(input.episode)
        : 0,
    position:
      Number.isFinite(Number(input?.position))
        ? Math.max(0, Number(input.position))
        : 0,
    duration:
      Number.isFinite(Number(input?.duration))
        ? Math.max(0, Number(input.duration))
        : 0,
    watchedAt:
      typeof input?.watchedAt === 'string'
        ? input.watchedAt
        : now,
    updatedAt: now,
  }
}
function cleanGuestInvites(invites) {
  const now = Date.now()

  return invites.filter(
    (invite) =>
      invite &&
      typeof invite.token === 'string' &&
      typeof invite.expiresAt === 'number' &&
      invite.expiresAt > now &&
      invite.revoked !== true,
  )
}

function createGuestToken() {
  return randomBytes(32).toString('base64url')
}

function getLanIPv4() {
  const interfaces = os.networkInterfaces()

  const candidates = []

  for (const entries of Object.values(interfaces)) {
    if (!Array.isArray(entries)) continue

    for (const entry of entries) {
      if (!entry) continue
      if (entry.family !== 'IPv4') continue
      if (entry.internal) continue

      candidates.push(entry.address)
    }
  }

  // Prefer normal private LAN addresses.
  const privateAddress = candidates.find((address) =>
    /^10\./.test(address) ||
    /^192\.168\./.test(address) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(address)
  )

  return privateAddress || candidates[0] || '127.0.0.1'
}

function guestInviteResponse(invite, req) {
  const host = getLanIPv4()

  const port =
    process.env.EVOL_WEB_PORT ||
    '5173'

  return {
    token: invite.token,
    expiresAt: invite.expiresAt,
    createdAt: invite.createdAt,
    host,
    guestUrl:
      `http://${host}:${port}/guest/${encodeURIComponent(invite.token)}`,
  }
}

const CDNLIVE_TV_USER = process.env.CDNLIVE_TV_USER || 'cdnlivetv'
const CDNLIVE_TV_PLAN = process.env.CDNLIVE_TV_PLAN || 'free'
const CDNLIVE_TV_API = 'https://api.cdnlivetv.is/api/v1'

async function cdnLiveTV(endpoint) {
  const separator = endpoint.includes('?') ? '&' : '?'

  const url =
    `${CDNLIVE_TV_API}${endpoint}` +
    `${separator}user=${encodeURIComponent(CDNLIVE_TV_USER)}` +
    `&plan=${encodeURIComponent(CDNLIVE_TV_PLAN)}`

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(
      `CDN Live TV request failed: ${response.status}`,
    )
  }

  return response.json()
}

async function getCDNLiveTVSports() {
  const result = await cdnLiveTV('/events/sports/')

  return result?.['cdn-live-tv'] || result?.data || {}
}

function flattenCDNSports(data) {
  const sports = []

  for (const [sport, events] of Object.entries(data || {})) {
    if (!Array.isArray(events)) continue

    for (const event of events) {
      if (!event || typeof event !== 'object') continue

      sports.push({
        ...event,
        sport,
        channels: Array.isArray(event.channels)
          ? event.channels
          : [],
      })
    }
  }

  return sports
}
const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    json(res, 204, {})
    return
  }

  try {
    const requestUrl = new URL(
      req.url || '/',
      `http://${req.headers.host || 'localhost'}`,
    )

    // --------------------------------------------------------
    // Health
    // --------------------------------------------------------

    if (requestUrl.pathname === '/api/health') {
      json(res, 200, {
        ok: true,
        hyperbeam: Boolean(HB_API_KEY),
        dlhd: Boolean(DLHD_API_KEY),
      })
      return
    }


// --------------------------------------------------------
// --------------------------------------------------------
// Library
// --------------------------------------------------------

if (
  req.method === 'GET' &&
  requestUrl.pathname === '/api/library/watchlist'
) {
  const library = await readLibrary()

  json(res, 200, {
    items: library.watchlist,
  })
  return
}

if (
  req.method === 'POST' &&
  requestUrl.pathname === '/api/library/watchlist'
) {
  let body = ''

  for await (const chunk of req) {
    body += chunk
  }

  let input

  try {
    input = JSON.parse(body || '{}')
  } catch {
    json(res, 400, { error: 'Invalid JSON' })
    return
  }

  if (
    !input.mediaId ||
    !input.name ||
    !['movie', 'series'].includes(input.type)
  ) {
    json(res, 400, {
      error: 'type, mediaId and name are required',
    })
    return
  }

  const library = await readLibrary()

  const existing = library.watchlist.find(
    (item) =>
      item.type === input.type &&
      item.mediaId === String(input.mediaId),
  )

  if (existing) {
    json(res, 200, {
      item: existing,
      alreadyExists: true,
    })
    return
  }

  const item = normalizeLibraryItem(input)

  item.id = nextLibraryId([
    ...library.watchlist,
    ...library.history,
  ])

  library.watchlist.unshift(item)

  await writeLibrary(library)

  json(res, 201, { item })
  return
}

if (
  req.method === 'DELETE' &&
  requestUrl.pathname.startsWith('/api/library/watchlist/')
) {
  const parts = requestUrl.pathname
    .split('/')
    .filter(Boolean)

  const type = parts[3]
  const mediaId = decodeURIComponent(parts.slice(4).join('/'))

  if (
    !['movie', 'series'].includes(type) ||
    !mediaId
  ) {
    json(res, 400, {
      error: 'Invalid watchlist item',
    })
    return
  }

  const library = await readLibrary()

  const before = library.watchlist.length

  library.watchlist = library.watchlist.filter(
    (item) =>
      !(
        item.type === type &&
        item.mediaId === mediaId
      ),
  )

  if (library.watchlist.length !== before) {
    await writeLibrary(library)
  }

  json(res, 200, {
    removed: library.watchlist.length !== before,
  })
  return
}

if (
  req.method === 'GET' &&
  requestUrl.pathname === '/api/library/history'
) {
  const library = await readLibrary()

  json(res, 200, {
    items: library.history,
  })
  return
}

if (
  req.method === 'POST' &&
  requestUrl.pathname === '/api/library/history'
) {
  let body = ''

  for await (const chunk of req) {
    body += chunk
  }

  let input

  try {
    input = JSON.parse(body || '{}')
  } catch {
    json(res, 400, { error: 'Invalid JSON' })
    return
  }

  if (
    !input.mediaId ||
    !input.name ||
    !['movie', 'series'].includes(input.type)
  ) {
    json(res, 400, {
      error: 'type, mediaId and name are required',
    })
    return
  }

  const library = await readLibrary()

  const existingIndex = library.history.findIndex(
    (item) =>
      item.type === input.type &&
      item.mediaId === String(input.mediaId) &&
      Number(item.season || 0) === Number(input.season || 0) &&
      Number(item.episode || 0) === Number(input.episode || 0),
  )

  const existing =
    existingIndex >= 0
      ? library.history[existingIndex]
      : undefined

  const item = normalizeLibraryItem(
    input,
    existing?.id,
  )

  if (existingIndex >= 0) {
    library.history.splice(existingIndex, 1)
  } else {
    item.id = nextLibraryId([
      ...library.watchlist,
      ...library.history,
    ])
  }

  library.history.unshift(item)

  library.history = library.history.slice(0, 100)

  await writeLibrary(library)

  json(res, 200, { item })
  return
}
// Guest invites
// --------------------------------------------------------

if (
  req.method === 'POST' &&
  requestUrl.pathname === '/api/guest/invites'
) {
  const requestedHours = Number(
    requestUrl.searchParams.get('hours') || 24,
  )

  const hours =
    Number.isFinite(requestedHours) &&
    requestedHours > 0 &&
    requestedHours <= 168
      ? requestedHours
      : 24

  const invites = cleanGuestInvites(
    await readGuestInvites(),
  )

  const now = Date.now()

  const invite = {
    token: createGuestToken(),
    createdAt: now,
    expiresAt: now + hours * 60 * 60 * 1000,
    revoked: false,
  }

  invites.push(invite)

  await writeGuestInvites(invites)

  json(res, 201, guestInviteResponse(invite, req))
  return
}

if (
  req.method === 'GET' &&
  requestUrl.pathname === '/api/guest/invites'
) {
  const invites = cleanGuestInvites(
    await readGuestInvites(),
  )

  await writeGuestInvites(invites)

  json(res, 200, {
    invites: invites.map((invite) =>
      guestInviteResponse(invite, req),
    ),
  })

  return
}

if (
  req.method === 'DELETE' &&
  requestUrl.pathname.startsWith('/api/guest/invites/')
) {
  const token = decodeURIComponent(
    requestUrl.pathname.slice('/api/guest/invites/'.length),
  )

  if (!token) {
    json(res, 400, {
      error: 'token is required',
    })
    return
  }

  const invites = await readGuestInvites()

  const index = invites.findIndex(
    (invite) => invite.token === token,
  )

  if (index === -1) {
    json(res, 404, {
      error: 'Invite not found',
    })
    return
  }

  invites[index].revoked = true

  await writeGuestInvites(invites)

  json(res, 200, {
    ok: true,
  })

  return
}

if (
  req.method === 'GET' &&
  requestUrl.pathname.startsWith('/api/guest/validate/')
) {
  const token = decodeURIComponent(
    requestUrl.pathname.slice('/api/guest/validate/'.length),
  )

  const invites = cleanGuestInvites(
    await readGuestInvites(),
  )

  const invite = invites.find(
    (entry) => entry.token === token,
  )

  if (!invite) {
    json(res, 401, {
      valid: false,
      error: 'Invite is invalid or expired',
    })
    return
  }

  json(res, 200, {
    valid: true,
    expiresAt: invite.expiresAt,
  })

  return
}

// --------------------------------------------------------
// CDN Live TV sports
// --------------------------------------------------------

if (
  req.method === 'GET' &&
  requestUrl.pathname === '/api/cdnlivetv/sports'
) {
  const data = await getCDNLiveTVSports()
  const events = flattenCDNSports(data)

  json(res, 200, {
    provider: 'cdn-live-tv',
    total: events.length,
    events,
  })

  return
}

if (
  req.method === 'GET' &&
  requestUrl.pathname === '/api/cdnlivetv/match'
) {
  const gameID =
    requestUrl.searchParams.get('gameID') || ''

  const home =
    requestUrl.searchParams.get('home') || ''

  const away =
    requestUrl.searchParams.get('away') || ''

  const data = await getCDNLiveTVSports()
  const events = flattenCDNSports(data)

  const normalHome = normalise(home)
  const normalAway = normalise(away)

  const match = events.find((event) => {
    if (gameID && String(event.gameID) === String(gameID)) {
      return true
    }

    if (!normalHome || !normalAway) return false

    return (
      normalise(event.homeTeam) === normalHome &&
      normalise(event.awayTeam) === normalAway
    )
  })

  if (!match) {
    json(res, 404, {
      error: 'Match not found',
    })
    return
  }

  json(res, 200, {
    provider: 'cdn-live-tv',
    match,
    streams: match.channels.map((channel) => ({
      id: `cdn-${channel.id}`,
      name: channel.channel_name,
      type: 'iframe',
      url: channel.url,
      image: channel.image || '',
      viewers: channel.viewers || 0,
    })),
  })

  return
}
    // --------------------------------------------------------
    // DLHD channels
    // --------------------------------------------------------

    if (
      req.method === 'GET' &&
      requestUrl.pathname === '/api/dlhd/channels'
    ) {
      const data = await dlhd('channels')
      json(res, 200, data)
      return
    }

    // --------------------------------------------------------
    // DLHD schedule
    // --------------------------------------------------------

    if (
      req.method === 'GET' &&
      requestUrl.pathname === '/api/dlhd/schedule'
    ) {
      const data = await dlhd('schedule')
      json(res, 200, data)
      return
    }

    // --------------------------------------------------------
    // DLHD streams matching a football fixture
    // --------------------------------------------------------

    if (
      req.method === 'GET' &&
      requestUrl.pathname === '/api/dlhd/match'
    ) {
      const home = requestUrl.searchParams.get('home') || ''
      const away = requestUrl.searchParams.get('away') || ''

      if (!home || !away) {
        json(res, 400, {
          error: 'home and away are required',
        })
        return
      }

      const streams = await handleDLHDMatch(home, away)

      json(res, 200, {
        home,
        away,
        streams,
      })

      return
    }

    // --------------------------------------------------------
    // Hyperbeam
    // --------------------------------------------------------

    if (
      req.method === 'GET' &&
      requestUrl.pathname === '/api/hyperbeam/session'
    ) {
      const target = requestUrl.searchParams.get('url') || ''

      if (!target) {
        json(res, 400, {
          error: 'url is required',
        })
        return
      }

      let parsed

      try {
        parsed = new URL(target)
      } catch {
        json(res, 400, {
          error: 'Invalid URL',
        })
        return
      }

      if (!['http:', 'https:'].includes(parsed.protocol)) {
        json(res, 400, {
          error: 'Only http/https URLs are allowed',
        })
        return
      }

      const session = await createHyperbeamSession(target)

      json(res, 200, session)
      return
    }

    json(res, 404, {
      error: 'Not found',
    })
  } catch (error) {
    console.error(error)

    json(res, 500, {
      error:
        error instanceof Error
          ? error.message
          : 'Internal server error',
    })
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log('')
  console.log('================================')
  console.log(' EV0L API SERVER')
  console.log('================================')
  console.log(`Listening: http://0.0.0.0:${PORT}`)
  console.log(`Hyperbeam: ${HB_API_KEY ? 'configured' : 'NOT configured'}`)
  console.log(`DLHD:      ${DLHD_API_KEY ? 'configured' : 'NOT configured'}`)
  console.log('')
})







