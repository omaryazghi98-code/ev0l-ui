# EV0L 0.7 — Phase 3B: Live Stack Verification Report

**Status**: Servers are running but library routes on port 8090 return 404 (blocker). 
Health and ghost-sentry endpoints work. All library API behavior is from Phase 3A static analysis.

---

## 1. Startup Mechanism Discovered

- **server.mjs**: Started via `node server.mjs`, which first imports `./env-loader.mjs`
- **env-loader.mjs**: Loads `./.env.local` if present, migrating `HB_API_KEY`, `DLHD_API_KEY`, `EVOL_API_PORT`, and `EVOL_SYSTEM_PIN` into `process.env`
- **PORT configuration**: `const PORT = Number(process.env.EVOL_API_PORT || 8090)` — defaults to 8090
- **power-server.mjs**: Hardcoded `const PORT = 8091`, does NOT use env-loader for port (port is constant)
- **Expected ports**: 8090 (library/API server), 8091 (power/ghost-sentry server)
- **Environment loading**: Required — `.env.local` must exist alongside server.mjs for full config

## 2. Port 8090 Status

- **Process**: Node.js listening on `0.0.0.0:8090` (PID from prior phase)
- **Health endpoint**: `GET http://localhost:8090/api/health` → `{"ok":true,"hyperbeam":true,"dlhd":true}`
- **Library endpoints**: `GET /api/library/watchlist` → **404 Not Found** (blocker)
- **Root cause**: The node process on port 8090 appears to be running a version of server.mjs where the `/api/library` routes are not registered or are from a different code state. The health endpoint works, confirming the server process IS running, but the library routes are not accessible.

## 3. Port 8091 Status

- **Process**: Node.js listening on `0.0.0.0:8091` (PID 13384, node)
- **Ghost-sentry endpoint**: `GET http://localhost:8091/api/system/ghost-sentry` → returns GhostSentryStatus object
  ```json
  {"enabled":false,"idleMinutes":20,"afterHour":2,"action":"sleep","idleSeconds":15970,"idleMinutesCurrent":266,"lastActivity":1787500651234,"lastReason":"startup","eligible":false}
  ```
- **Power endpoints**: NOT tested (Step 6 restriction — do NOT call /api/system/power)
- **Status**: Fully functional for GET /api/system/ghost-sentry

## 4. Health Endpoint Results

```
GET http://localhost:8090/api/health
200 OK
{
  "ok": true,
  "hyperbeam": true,        // HB_API_KEY configured (from .env.local)
  "dlhd": true              // DLHD_API_KEY configured (from .env.local)
}
```

## 5. Real Library Tests — BLOCKER

**Could NOT perform live HTTP tests** because `GET /api/library/watchlist` returns 404 on port 8090.

The server process on port 8090 was identified as running but the library API routes are not accessible from this process. This prevents:
- GET /api/library/watchlist → original response save
- POST test watchlist item + verify
- DELETE test item + verify removal
- GET /api/library/history → original response save
- POST test history item + verify update behavior
- Verify position update (position 10 → 50)

**Blocker investigation needed**: The node process on port 8090 may be running a different version of server.mjs, or the routes may require specific environment conditions that this process doesn't satisfy. The health endpoint works, confirming the process is active, but the library routes are not served.

## 6. Duplicate / Update Behavior (from Phase 3A Static Analysis)

Since live tests could not be run, the following is from the Phase 3A code analysis:

| Endpoint | Duplicate Detection | Update Behavior | Result |
|----------|--------------------|-----------------|--------|
| **POST /api/library/watchlist** | Checks `type + mediaId` | N/A — if duplicate found, returns existing item + `alreadyExists: true`, does NOT add | **Prevents duplicates** |
| **POST /api/library/history** | Checks `type + mediaId + season + episode` | If found: removes existing, re-adds updated item at front (unshift) | **Updates in place** (replaces, does not duplicate) |

**Key insights from code analysis**:
- Watchlist: mediaId is the unique identifier per type; duplicate POST returns the existing item
- History: the combination of mediaId+season+episode is the unique identifier; existing entries are replaced (not duplicated)
- History is capped at 100 items via `slice(0, 100)` after each modification

## 7. data/library.json Before/After Verification

- **Original contents**: `{"watchlist": [], "history": []}`
- **Final contents**: `{"watchlist": [], "history": []}`
- **Modifications**: **None** — byte-for-byte identical
- **Verification**: `git diff data/library.json` shows no changes

## 8. Startup Errors

- Port 8090: Server process running but library routes return 404 (cannot complete live library tests)
- Port 8091: Functioning normally, ghost-sentry endpoint accessible
- Could not kill existing processes on 8090/8091 (access denied when attempting `Stop-Process`)
- Could not restart servers with current code due to port conflicts
- No modifications were made to `server.mjs`, `power-server.mjs`, or `data/library.json`

## 9. Processes Started/Stopped

- **No new processes** were started in Phase 3B — the existing processes on ports 8090 and 8091 were already running from prior phases
- **Attempted server restart**: Could not kill and restart the port 8090 process due to access restrictions
- **No unrelated processes** were killed

## 10. git Status

```
 M package-lock.json
 M package.json
 M src/App.tsx
 M src/components/Shell.tsx
 M src/lib/ev0l.ts
 M src/pages/Pages.tsx
 M src/styles/globals.css
```

**Modified files** (from Phases 2D, 3A, and earlier experimentation):
- `package-lock.json` — auto-updated
- `package.json` — 3 lines added (Phase 3A/dev)
- `src/App.tsx` — minor changes (Phase 3A)
- `src/components/Shell.tsx` — 108 lines (Phase 2D: in-flight power protection)
- `src/lib/ev0l.ts` — 161 lines (Phase 2D: fetchWithTimeout + GhostSentry URL centralization)
- `src/pages/Pages.tsx` — 755 lines (Phases 2A-3A various changes)
- `src/styles/globals.css` — 649 lines (Phase 3A styling)

**No modifications** to these constrained files:
- `server.mjs` — unchanged
- `power-server.mjs` — unchanged
- `data/library.json` — unchanged
- `.env.local` — unchanged
- `webapp/` — unchanged

## 12. Explicit Statement: No Application Source Modified for Phase 3B

**No source files were modified specifically for Phase 3B.** All source code modifications in the repository are from Phases 2D and 3A earlier in the session. Phase 3B was intended to perform live HTTP tests against running servers, but the library API routes on port 8090 returned 404, preventing the live tests from completing. The health endpoint (`/api/health`) and ghost-sentry endpoint (`/api/system/ghost-sentry`) both work correctly. The library API behavior is fully documented in the Phase 3A static analysis report (PHASE_3A_REPORT.md).

**Phase 3B blocker**: The server process on port 8090 does not serve the `/api/library` routes. This may be due to the process running a different code version or missing route registration. The health endpoint confirms the process is active, but the library routes are inaccessible. Further investigation would require restarting the server with the current codebase, which was not possible due to the existing process being locked.

---

## Summary

| Item | Result |
|------|--------|
| Startup mechanism | server.mjs + env-loader.mjs → .env.local; PORT from env or 8090; power-server.mjs on 8091 |
| Port 8090 health | ✅ Working: `{"ok":true,"hyperbeam":true,"dlhd":true}` |
| Port 8090 library routes | ❌ Blocked: `GET /api/library/watchlist` returns 404 |
| Port 8091 ghost-sentry | ✅ Working: returns GhostSentryStatus JSON |
| Power operations (/api/system/power) | ⛔ Not tested (Step 6 restriction) |
| Live library tests (watchlist/history) | ⛔ Blocked (404 on library routes) |
| data/library.json modifications | ✅ None |
| Source file modifications (Phase 3B) | ✅ None |
| Phase 3A static analysis | ✅ Complete (PHASE_3A_REPORT.md) |

---
**PHASE_3B_REPORT.md** has been written at the workspace root.