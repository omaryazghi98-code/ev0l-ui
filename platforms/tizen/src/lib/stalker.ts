export type StalkerConfig = {
  portalUrl: string
  macAddress: string
  username?: string
  password?: string
}

export type StalkerProfile = {
  id?: string
  name?: string
  mac?: string
}

export type StalkerChannel = {
  id: string
  name: string
  logo?: string
  streamUrl?: string
  categoryId?: string
}

export type StalkerAdapter = {
  config: StalkerConfig
  handshake(): Promise<string>
  getProfile(token: string): Promise<StalkerProfile>
  getChannels(token: string): Promise<StalkerChannel[]>
}

function baseUrl(portalUrl: string) {
  return portalUrl.replace(/\/+$/, '')
}

function headers(macAddress: string, token?: string) {
  const value = token ? `Bearer ${token}` : ''
  return {
    Accept: 'application/json',
    ...(value ? { Authorization: value } : {}),
    'X-User-Agent': 'EV0L-Tizen/0.1',
    'X-MAC': macAddress,
  }
}

export function createStalkerAdapter(config: StalkerConfig): StalkerAdapter {
  const portal = baseUrl(config.portalUrl)

  return {
    config,

    async handshake() {
      const response = await fetch(`${portal}/portal.php?type=stb&action=handshake`, {
        headers: headers(config.macAddress),
      })
      if (!response.ok) throw new Error(`Stalker handshake failed (${response.status})`)
      const data = await response.json() as { js?: { token?: string } }
      const token = data.js?.token
      if (!token) throw new Error('Stalker portal returned no token')
      return token
    },

    async getProfile(token) {
      const response = await fetch(`${portal}/portal.php?type=stb&action=get_profile`, {
        headers: headers(config.macAddress, token),
      })
      if (!response.ok) throw new Error(`Stalker profile failed (${response.status})`)
      return response.json() as Promise<StalkerProfile>
    },

    async getChannels(token) {
      const response = await fetch(`${portal}/portal.php?type=itv&action=get_all_channels`, {
        headers: headers(config.macAddress, token),
      })
      if (!response.ok) throw new Error(`Stalker channels failed (${response.status})`)
      const data = await response.json() as { js?: Array<Record<string, unknown>> }
      return (data.js ?? []).map((item, index) => ({
        id: String(item.id ?? item.ch_id ?? index),
        name: String(item.name ?? item.tv_genre_name ?? `Channel ${index + 1}`),
        logo: typeof item.logo === 'string' ? item.logo : undefined,
        streamUrl: typeof item.cmd === 'string' ? item.cmd : undefined,
        categoryId: item.tv_genre_id != null ? String(item.tv_genre_id) : undefined,
      }))
    },
  }
}
