import http from 'node:http'
import crypto from 'node:crypto'
import { execFile } from 'node:child_process'
import fs from 'node:fs'

const PORT = 8091
const ENV_FILE = new URL('./.env.local', import.meta.url)

if (fs.existsSync(ENV_FILE)) {
  const text = fs.readFileSync(ENV_FILE, 'utf8')

  for (const line of text.split(/\r?\n/)) {
    const value = line.trim()
    if (!value || value.startsWith('#')) continue

    const i = value.indexOf('=')
    if (i <= 0) continue

    const key = value.slice(0, i).trim()
    const val = value.slice(i + 1).trim()

    if (!(key in process.env)) {
      process.env[key] = val
    }
  }
}

const PIN = process.env.EVOL_SYSTEM_PIN || ''

if (!PIN) {
  console.error('')
  console.error('EVOL_SYSTEM_PIN is not configured in .env.local')
  console.error('')
  process.exit(1)
}

function json(res, status, body) {
  const payload = JSON.stringify(body)

  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })

  res.end(payload)
}

function validPin(received) {
  if (!received) return false

  const a = Buffer.from(String(received))
  const b = Buffer.from(String(PIN))

  if (a.length !== b.length) return false

  return crypto.timingSafeEqual(a, b)
}

const ghostSentry = {
  enabled: false,
  idleMinutes: 20,
  afterHour: 2,
  action: 'sleep',
  lastActivity: Date.now(),
  lastReason: 'startup',
  sleeping: false,
}

function reportActivity(reason = 'activity') {
  ghostSentry.lastActivity = Date.now()
  ghostSentry.lastReason = String(reason)
  ghostSentry.sleeping = false
}

function isAfterHour(hour) {
  const now = new Date()
  return now.getHours() >= hour
}

function ghostStatus() {
  const idleMs = Math.max(0, Date.now() - ghostSentry.lastActivity)
  const idleSeconds = Math.floor(idleMs / 1000)
  const thresholdSeconds = ghostSentry.idleMinutes * 60

  return {
    enabled: ghostSentry.enabled,
    idleMinutes: ghostSentry.idleMinutes,
    afterHour: ghostSentry.afterHour,
    action: ghostSentry.action,
    idleSeconds,
    idleMinutesCurrent: Math.floor(idleSeconds / 60),
    lastActivity: ghostSentry.lastActivity,
    lastReason: ghostSentry.lastReason,
    eligible:
      ghostSentry.enabled &&
      !ghostSentry.sleeping &&
      isAfterHour(ghostSentry.afterHour) &&
      idleSeconds >= thresholdSeconds,
  }
}

function checkGhostSentry() {
  if (!ghostSentry.enabled || ghostSentry.sleeping) return

  const status = ghostStatus()

  if (!status.eligible) return

  ghostSentry.sleeping = true

  console.log('')
  console.log('================================')
  console.log(' GHOST SENTRY')
  console.log(' =================================')
  console.log(`Idle: ${status.idleMinutesCurrent} minutes`)
  console.log(`Threshold: ${ghostSentry.idleMinutes} minutes`)
  console.log(`Last activity: ${ghostSentry.lastReason}`)
  console.log('No activity detected. Putting system to sleep.')
  console.log('')

  try {
    runPowerAction(ghostSentry.action)
  } catch (error) {
    ghostSentry.sleeping = false
    console.error('Ghost Sentry sleep failed:', error)
  }
}
function runPowerAction(action) {
  if (action === 'sleep') {
    execFile(
      'rundll32.exe',
      ['powrprof.dll,SetSuspendState', '0,1,0'],
    )
    return
  }

  if (action === 'restart') {
    execFile(
      'shutdown.exe',
      ['/r', '/t', '5'],
    )
    return
  }

  if (action === 'shutdown') {
    execFile(
      'shutdown.exe',
      ['/s', '/t', '5'],
    )
    return
  }

  throw new Error('Invalid power action')
}

const server = http.createServer((req, res) => {

  if (
    req.method === 'GET' &&
    req.url === '/api/system/ghost-sentry'
  ) {
    json(res, 200, ghostStatus())
    return
  }

  if (
    req.method === 'POST' &&
    req.url === '/api/system/activity'
  ) {
    let body = ''

    req.on('data', chunk => {
      body += chunk
    })

    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}')

        reportActivity(
          data.reason ||
          'activity'
        )

        json(res, 200, {
          ok: true,
          ...ghostStatus(),
        })
      } catch {
        json(res, 400, {
          error: 'Invalid request',
        })
      }
    })

    return
  }

  if (
    req.method === 'POST' &&
    req.url === '/api/system/ghost-sentry'
  ) {
    let body = ''

    req.on('data', chunk => {
      body += chunk
    })

    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}')

        if (!validPin(data.pin)) {
          json(res, 401, {
            error: 'Invalid PIN',
          })
          return
        }

        if (typeof data.enabled === 'boolean') {
          ghostSentry.enabled = data.enabled
        }

        if (
          data.idleMinutes !== undefined
        ) {
          const minutes = Number(data.idleMinutes)

          if (
            !Number.isFinite(minutes) ||
            minutes < 1 ||
            minutes > 1440
          ) {
            json(res, 400, {
              error: 'idleMinutes must be between 1 and 1440',
            })
            return
          }

          ghostSentry.idleMinutes = minutes
        }

        if (data.action !== undefined) {
          const action = String(data.action)

          if (!['sleep', 'shutdown', 'restart'].includes(action)) {
            json(res, 400, {
              error: 'action must be sleep, shutdown, or restart',
            })
            return
          }

          ghostSentry.action = action
        }

        if (
          data.afterHour !== undefined
        ) {
          const hour = Number(data.afterHour)

          if (
            !Number.isInteger(hour) ||
            hour < 0 ||
            hour > 23
          ) {
            json(res, 400, {
              error: 'afterHour must be between 0 and 23',
            })
            return
          }

          ghostSentry.afterHour = hour
        }

        reportActivity('ghost-sentry configuration changed')

        json(res, 200, {
          ok: true,
          ...ghostStatus(),
        })
      } catch {
        json(res, 400, {
          error: 'Invalid request',
        })
      }
    })

    return
  }

  if (req.method === 'OPTIONS') {
    json(res, 204, {})
    return
  }

  if (
    req.method !== 'POST' ||
    req.url !== '/api/system/power'
  ) {
    json(res, 404, { error: 'Not found' })
    return
  }

  let body = ''

  req.on('data', chunk => {
    body += chunk
  })

  req.on('end', () => {
    try {
      const data = JSON.parse(body || '{}')
      const { action, pin } = data

      if (!validPin(pin)) {
        json(res, 401, { error: 'Invalid PIN' })
        return
      }

      if (!['sleep', 'restart', 'shutdown'].includes(action)) {
        json(res, 400, { error: 'Invalid action' })
        return
      }

      json(res, 200, {
        ok: true,
        action,
      })

      setTimeout(() => {
        try {
          runPowerAction(action)
        } catch (error) {
          console.error(error)
        }
      }, 250)
    } catch {
      json(res, 400, { error: 'Invalid request' })
    }
  })
})

setInterval(checkGhostSentry, 30 * 1000)

server.listen(PORT, '0.0.0.0', () => {
  console.log('')
  console.log('================================')
  console.log(' EV0L POWER SERVER')
  console.log('================================')
  console.log(`Listening on port ${PORT}`)
  console.log('Sleep / Restart / Shutdown enabled')
  console.log('')
})



