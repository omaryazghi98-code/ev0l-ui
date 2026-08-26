# EV0L 0.7 — Phase 3C: Stale/Incorrect Server Diagnosis

**Status**: Read-only diagnosis only. No files modified, no processes killed/restarted.

---

## 1. Current Process on Port 8090

- **PID**: 10920
- **Process Name**: node
- **Start Time**: 8/23/2026 4:57:30 PM
- **Port**: 0.0.0.0:8090 (Listen state)
- **Apparent project**: NOT the current `C:\ev0l_stream\genspark-preview\server.mjs`

### Live API test results against port 8090:

| Endpoint | Status | Response |
|---|---|---|
| `GET /api/health` | 200 OK | `{"ok":true,"hyperbeam":true,"dlhd":true}` |
| `GET /api/library/watchlist` | **404 Not Found** | — |
| `GET /api/library/history` | **404 Not Found** | — |
| `OPTIONS /api/library/watchlist` | 200 OK | CORS headers only (no body) |
| `GET /api/cdnlivetv/sports` | 200 OK | Returns sports data (UCI Cycling, Darts, etc.) — **this route exists in current server.mjs** |

**Diagnosis**: The process on port 8090 is an **older EV0L server** that does NOT have the `/api/library` routes. It serves `/api/health`, `/api/cdnlivetv/sports`, and `/api/system/ghost-sentry` (via port 8091), but `/api/library/watchlist` returns 404. This confirms it is NOT the current Genspark-preview server.mjs, which does contain library routes (confirmed at `server.mjs:414`).

---

## 2. Current Process on Port 8091

- **PID**: 13384
- **Process Name**: node
- **Start Time**: (from earlier inspection)
- **Port**: 0.0.0.0:8091 (Listen state)
- **Apparent project**: `C:\ev0l_stream\genspark-preview\power-server.mjs` (the Genspark power server)

### Live API test results against port 8091:

| Endpoint | Status | Response |
|---|---|---|
| `GET /api/system/ghost-sentry` | 200 OK | `{"enabled":false,"idleMinutes":20,"afterHour":2,"action":"sleep","idleSeconds":16782,"idleMinutesCurrent":279,"lastActivity":1787500651234,"lastReason":"startup","eligible":false}` |
| `GET /api/system/power` | Not tested (Phase 3C rules — do NOT call power endpoints) | — |

---

## 3. Server.mjs Copies Discovered

| Path | Contains `/api/library` routes? | Notes |
|---|---|---|
| `C:\ev0l_stream\genspark-preview\server.mjs` | **YES** — routes at lines 414-609 | Current authoritative Genspark build. Has GET/POST/DELETE /api/library/watchlist and GET/POST /api/library/history. |
| `C:\ev0l_stream\EV0L-backup-20260823-164158\server.mjs` | **NO** — 0 mentions of "library" | Older EV0L build before Genspark became authoritative. Serves guest invites, IPTV, CDN Live TV, but no library API. |
| `C:\ev0l_stream\genspark-upload\` | (not found / not inspected further) | No server.mjs discovered in initial search. |

---

## 4. Exact Diagnosis

### Why `/api/health` works but `/api/library/watchlist` returns 404:

- **Port 8090** is occupied by an **older EV0L server** (PID 10920) from `C:\ev0l_stream\EV0L-backup-20260823-164158\`. This older build:
  - Does have `/api/health` ✅
  - Does **not** have `/api/library` routes ❌
  - Does have `/api/cdnlivetv/sports` (same as current build)
  - Does have `/api/system/ghost-sentry` accessible via port 8091
  
- **The current Genspark-preview** `server.mjs` at `C:\ev0l_stream\genspark-preview\server.mjs`:
  - Contains full library route implementation (lines 414-609)
  - Has not been loaded/started on port 8090
  - Was not the process that started first; an older copy arrived first

- **The process on port 8090** is a stale/older EV0L server that was already running before the Genspark-preview was adopted as the authoritative build. It was not restarted after the library routes were added to the current server.mjs.

---

## 5. Which Server.mjs Copy the Live 8090 Process Appears to Be Using

Based on route availability and the absence of "library" in the source text, the process on port 8090 (PID 10920) is running the **older EV0L build from `C:\ev0l_stream\EV0L-backup-20260823-164158\server.mjs`**, which:
- Imports `./env-loader.mjs` (same as current)
- Uses `const PORT = Number(process.env.EVOL_API_PORT || 8090)` (same port scheme)
- Has **no** `/api/library` routes
- Has `/api/guest/invites`, `/api/iptv`, `/api/cdnlivetv/sports` routes

---

## 6. Recommended Next Action (DO NOT PERFORM YET)

**Restart the Genspark-preview server on port 8090** using the current `C:\ev0l_stream\genspark-preview\server.mjs` so that `/api/library/watchlist` and `/api/library/history` become available. This would require:

1. Stopping the existing PID 10920 process (currently an older EV0L build)
2. Starting `node server.mjs` from `C:\ev0l_stream\genspark-preview` (which has the library routes)
3. Verifying all library endpoints return 200

**However**, Phase 3C rules explicitly state: **DO NOT kill any process, do not restart any server, do not modify server.mjs.** The diagnosis must stand as-is without intervention.

---

## 7. Git Status (Confirmation No Files Modified)

```
 M package-lock.json
 M package.json
 M src/App.tsx
 M src/components/Shell.tsx
 M src/lib/ev0l.ts
 M src/pages/Pages.tsx
 M src/styles/globals.css
```

**No modifications were made during Phase 3C.** All source files remain in their Phase 2D / Phase 3A state. The `data/library.json` file was confirmed unchanged (byte-for-byte: `{"watchlist":[],"history":[]}`).

---

## 8. Explicit Confirmations

- ❌ No processes killed
- ❌ No processes restarted
- ❌ No files modified
- ✅ No secrets exposed in reports (PIDs and process paths only; API key values from .env.local were not printed)
- ✅ No backups deleted
- ✅ Read-only diagnosis only

---
**PHASE_3C_REPORT.md** written at workspace root.