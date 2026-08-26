export type StalkerBackendConfig = {
  apiBase: string
}

export type StalkerChannel = {
  id: string
  name: string
  logo?: string
  groupId?: string
  cmd?: string
  tvGenreId?: string
  [key: string]: unknown
}

export type StalkerGroup = {
  id: string
  title: string
  [key: string]: unknown
}

export type StalkerMedia = {
  id: string
  name?: string
  poster?: string
  type?: 'movie' | 'series' | 'tv'
  [key: string]: unknown
}

export type StalkerEpgItem = {
  id?: string
  channelId?: string
  title?: string
  start?: string
  end?: string
  [key: string]: unknown
}

function trimBase(value: string) {
  return value.replace(/\/+$/, '')
}

async function request<T>(config: StalkerBackendConfig, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${trimBase(config.apiBase)}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
  })

  if (!response.ok) {
    let message = ''
    try {
      const body = await response.json() as { error?: string; message?: string }
      message = body.error || body.message || ''
    } catch {
      // Ignore non-JSON error bodies.
    }
    throw new Error(`Stalker backend request failed (${response.status})${message ? `: ${message}` : ''}`)
  }

  return response.json() as Promise<T>
}

/**
 * Adapter for the backend/proxy architecture used by the reference stalker-ui.
 * The TV app never needs upstream portal credentials when this mode is used;
 * the backend owns portal/session details and the TV client only consumes its
 * normalized media/channel API.
 */
export function createStalkerBackend(config: StalkerBackendConfig) {
  return {
    getChannels(signal?: AbortSignal) {
      return request<StalkerChannel[]>(config, '/v2/channels', { signal })
    },

    getChannelGroups(all = false, signal?: AbortSignal) {
      const query = all ? '?all=true' : ''
      return request<StalkerGroup[]>(config, `/v2/groups${query}`, { signal })
    },

    getMovieGroups(signal?: AbortSignal) {
      return request<StalkerGroup[]>(config, '/v2/movie-groups', { signal })
    },

    getSeriesGroups(signal?: AbortSignal) {
      return request<StalkerGroup[]>(config, '/v2/series-groups', { signal })
    },

    getEpg(signal?: AbortSignal) {
      return request<{ timestamp: number; data: Record<string, StalkerEpgItem[]> }>(config, '/v2/epg', { signal })
    },

    getChannelUrl(cmd: string, signal?: AbortSignal) {
      const query = new URLSearchParams({ cmd })
      return request<{ url?: string; streamUrl?: string }>(config, `/v2/channel-link?${query.toString()}`, { signal })
    },

    getMovieUrl(params: Record<string, string | number | boolean | undefined>, signal?: AbortSignal) {
      const query = new URLSearchParams()
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) query.set(key, String(value))
      }
      return request<{ url?: string; streamUrl?: string }>(config, `/v2/movie-link?${query.toString()}`, { signal })
    },

    getExpiry(signal?: AbortSignal) {
      return request<{ success: boolean; expiry: string | null }>(config, '/v2/expiry', { signal })
    },
  }
}
