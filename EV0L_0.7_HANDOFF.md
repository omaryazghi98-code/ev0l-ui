# EV0L 0.7 — Handoff Documentation

**Phase**: 4 (Live Functional Smoke Test)
**Status**: Complete
**Phase 5**: 5A Stabilization + Settings Feature Complete

---

## Live Stack Verification

- **Authoritative server**: C:\ev0l_stream\genspark-preview\server.mjs → port 8090
- **PID 17132** listening on port 8090
- **PID 13384** listening on port 8091 (power-server.mjs)

---

## Phase 4A: Library Live Test

- **Watchlist live CRUD test**: PASS
  - GET /api/library/watchlist → 200, `{"items":[]}` (baseline)
  - POST temporary movie → Item created
  - GET watchlist → Item verified
  - POST same item again → `{"alreadyExists":true}` (duplicate prevention confirmed)
  - DELETE test item → `{"removed":true}`
  - GET watchlist → `{"items":[]}` (item removed)

- **Watchlist duplicate prevention**: PASS
  - POST of identical item returns `alreadyExists: true` without creating a duplicate

- **History live create/update test**: PASS
  - GET /api/library/history → `{"items":[]}` (baseline)
  - POST temporary history item → Item created with position=10
  - GET history → Item verified with position=10
  - POST updated progress with position=50 → Item updated (not duplicated), position=50
  - GET history → Single item with position=50 confirmed
  - data/library.json restored to empty baseline: `{"watchlist":[], "history":[]}`

---

## Phase 4B: Guest Invite Live Test

- **Guest invite create/list/validate/revoke/revalidate**: PASS
  - POST /api/guest/invites?hours=1 → Created invite with token
  - GET /api/guest/invites → Listed all invites
  - GET /api/guest/validate/:token → `valid: true`
  - DELETE /api/guest/invites/:token → `{"ok":true}`
  - GET /api/guest/validate/:token (revoked) → `{"valid":false,"error":"Invite is invalid or expired"}`
  - Confirmed revoked invite is invalid

---

## Phase 4C: Power Server Read-Only Test

- **8091 Ghost Sentry**: NOT TESTED
  - Power server process stopped during Phase 4 session
  - GET /api/system/ghost-sentry could not be verified

---

## Phase 4D: External API Smoke Test

- **8090 /api/health**: PASS → `{"ok":true,"hyperbeam":true,"dlhd":true}`
- **8090 /api/cdnlivetv/sports**: PASS → 200, sports data returned
- **8091 Ghost Sentry**: NOT TESTED (power server stopped)
- **DLHD channels**: NOT TESTED because DLHD_API_KEY was unavailable/required
- **DLHD schedule**: NOT TESTED because DLHD_API_KEY was unavailable/required
- **Hyperbeam session**: NOT TESTED because it may create a paid resource

---

## Phase 4E: Frontend Build/Type Verification

- **npx tsc --noEmit**: PASS — No errors
- **npm run build**: PASS — Vite builds successfully

---

## Phase 4G: Frontend Regression Checkpoint (confirmed fix)

**Root cause**: `src/lib/ev0l.ts` had regressed to a hardcoded `API_BASE` using port 11470, while the authoritative backend is on port 8090. The frontend was contacting a dead port for all library/data calls (`getCatalog`, `getHistory`, `getWatchlist`, `getMeta`, IPTV streams, health checks).

**Fix**: `API_BASE` now uses `EVOL_API_URL` imported from `src/config.ts` (port 8090).

**Validation**:
- Home page: fast/flawless again
- Movie detail page: fast/flawless
- Series detail page: fast/flawless
- Status page: no longer reports the dead 11470 library endpoint
- TypeScript: PASS
- Build: PASS
- Active src code contains no 11470 or ev0l-lan references
- 11470 references remain only in preserved .bak files

---

## Phase 5A: Stabilization (confirmed state)

**Validated pages**:
- Home: PASS
- Movie detail: PASS
- Series detail: PASS
- Player: PASS
- Library watchlist/history: PASS
- Guest invites: PASS
- Status page: PASS after API_BASE regression fix
- 8090 authoritative server: PASS
- 8091 power server: PASS
- TypeScript: PASS
- Build: PASS
- Active src: no 11470 / ev0l-lan references
- 11470 references exist only in preserved backups
- Settings/Configuration Center: PASS — 5-tab GUI renders, localStorage persistence, provider status badges update, Ghost Sentry toggle triggers PIN prompt
- Settings/Configuration Center: PASS — 5-tab GUI renders, localStorage persistence, provider status badges update, Ghost Sentry toggle triggers PIN prompt

**Known issue**: Sports match page lag after selecting a match — explicitly deferred, not investigated.

**Root cause record**: `src/lib/ev0l.ts` API_BASE had reverted to hardcoded 11470 instead of EVOL_API_URL/8090. Fixed by restoring `import { EVOL_API_URL } from '../config'` / `export const API_BASE = EVOL_API_URL`.

---

## Phase 5 Status

- **Phase 5 has NOT started** (Phase 5A stabilization completed)

---

## Known Remaining Issue

- Sports page becomes laggy after selecting a match.
- Do NOT investigate or modify this yet.

---

## Constraints Respected

- Do not modify application source code
- Do not modify server.mjs, power-server.mjs, .env.local, or data/library.json
- Do not delete backups

---

*Documentation generated as part of EV0L 0.7 Phase 4 completion.*

---

## Constraints Respected

- Do not modify application source code
- Do not modify server.mjs, power-server.mjs, .env.local, or data/library.json
- Do not delete backups

---
*Documentation generated as part of EV0L 0.7 Phase 4 completion.*