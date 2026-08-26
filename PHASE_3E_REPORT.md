# EV0L 0.7 — Phase 3E: Port 8090 Switched to Authoritative Genspark Server

**Status**: Server switched successfully. PID 10920 (older EV0L build) was terminated, the authoritative Genspark server was started on port 8090, and all live API tests pass. No application source files were modified.

---

## 1. Old PID 10920 — Terminated

- **PID**: 10920
- **Process**: node (older EV0L build from `C:\ev0l_stream\EV0L-backup-20260823-164158\server.mjs`)
- **Port**: 8090 (Listen state)
- **Action**: **Terminated** manually by the operator
- **Result**: Port 8090 is now free and available for the authoritative server

---

## 2. New 8090 PID — Authoritative Genspark Server

- **New PID**: 17132
- **Process**: node
- **Script path**: `C:\ev0l_stream\genspark-preview\server.mjs` (confirmed via command line and working directory)
- **Port**: 0.0.0.0:8090 (Listen state)
- **Started**: Via PowerShell `Start-Process node -ArgumentList 'server.mjs' -WorkingDirectory 'C:\ev0l_stream\genspark-preview' -WindowStyle Hidden -PassThru`
- **Verification**: `GET /api/health` returns `{"ok":true,"hyperbeam":true,"dlhd":true}` — confirms the correct server is running

---

## 3. `/api/health` Result

```
GET http://localhost:8090/api/health
200 OK
{
  "ok": true,
  "hyperbeam": true,
  "dlhd": true
}
```

---

## 4. `/api/library/watchlist` Result

```
GET http://localhost:8090/api/library/watchlist
200 OK
{
  "items": []
}
```

**Previously**: 404 Not Found (stale EV0L server on port 8090)
**Now**: 200 OK with empty items array (authoritative Genspark server)

---

## 5. `/api/library/history` Result

```
GET http://localhost:8090/api/library/history
200 OK
{
  "items": []
}
```

**Previously**: 404 Not Found (stale EV0L server on port 8090)
**Now**: 200 OK with empty items array (authoritative Genspark server)

---

## 6. `8091` /api/system/ghost-sentry Result

```
GET http://localhost:8091/api/system/ghost-sentry
200 OK
{
  "enabled": false,
  "idleMinutes": 20,
  "afterHour": 2,
  "action": "sleep",
  "idleSeconds": 20075,
  "idleMinutesCurrent": 334,
  "lastActivity": 1787500651234,
  "lastReason": "startup",
  "eligible": false
}
```

**Confirmed**: PID 13384 on port 8091 was **NOT touched** and continues running the power-server.mjs as expected.

---

## 7. git status

```
 M package-lock.json
 M package.json
 M src/App.tsx
 M src/components/Shell.tsx
 M src/lib/ev0l.ts
 M src/pages/Pages.tsx
 M src/styles/globals.css
```

**No new modifications** were made during Phase 3E. All changes listed above are from Phases 2D and 3A. The following files were **not modified** during Phase 3E:

- `server.mjs` — unchanged
- `power-server.mjs` — unchanged
- `data/library.json` — restored to `{"watchlist":[], "history":[]}` after testing
- `.env.local` — unchanged
- `webapp/` — unchanged

---

## 8. Any Remaining Blocker

**None**. The server switch is complete:

- ✅ PID 10920 (older EV0L build) terminated
- ✅ Port 8090 is running the authoritative Genspark server.mjs
- ✅ `/api/health` → 200, `ok: true`
- ✅ `/api/library/watchlist` → 200 (was 404 before)
- ✅ `/api/library/history` → 200 (was 404 before)
- ✅ `/api/system/ghost-sentry` on port 8091 → 200 (untouched)
- ✅ No application source files modified
- ✅ `data/library.json` restored to original state

---

## Summary of All Four Phases

| Phase | Focus | Key Outcome |
|---|---|---|
| **2D** | Reliability Hardening | GhostSentry URL centralization, fetch timeout, power in-flight protection |
| **3A** | Library E2E Verification | Static analysis of all library APIs; report written |
| **3B** | Live Stack Verification | Health and ghost-sentry work; library routes blocked by stale server |
| **3C** | Stale Server Diagnosis | PID 10920 = older EV0L build; could not library routes on port 8090 |
| **3D** | Server Switch Attempt | PID 10920 could not be killed; server switch blocked |
| **3E** | Server Switch Complete | PID 10920 terminated; authoritative server started on port 8090 |

---

## Final State

- **New process on 8090**: PID 17132, `C:\ev0l_stream\genspark-preview\server.mjs`
- **Process on 8091**: PID 13384, `C:\ev0l_stream\genspark-preview\power-server.mjs` (untouched)
- **data/library.json**: `{"watchlist":[], "history":[]}` (restored after testing)
- **Source files**: No application source modifications during Phase 3E
- **Reports**: `PHASE_3A_REPORT.md`, `PHASE_3B_REPORT.md`, `PHASE_3C_REPORT.md`, `PHASE_3D_REPORT.md`, `PHASE_3E_REPORT.md` written

**Phase 3E is complete. The port 8090 switch to the authoritative Genspark server is successful.**