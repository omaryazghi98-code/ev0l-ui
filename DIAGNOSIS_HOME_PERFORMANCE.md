# Home-Page Performance & WelcomeBack Diagnosis

## Summary
Home page is slow/laggy on Acer laptop and iPhone but instant on Lenovo. WelcomeBack visual sequence does not appear on any devices. Other pages are unaffected. Backend APIs are healthy (~250-350ms).

## Root Causes

### 1. WelcomeBack Not Appearing
- **File**: `src/components/WelcomeBack.tsx:20-22, 26-47`
- The `visible` state is initialized from `sessionStorage.getItem('ev0l-welcome-shown') !== '1'`.
- In JavaScript, `null !== '1'` evaluates to `true`, so on a *completely fresh* visit (no sessionStorage key), `visible` should be `true` and WelcomeBack should appear.
- **However**, if `sessionStorage` already contains `'ev0l-welcome-shown' = '1'` (from a prior tab session, browser restore, or device-specific pre-population), `visible` initializes to `false`, and the `useEffect` also sets it to `false` on the first check (`'1' === '1'`), causing the component to return `null` immediately.
- This explains why WelcomeBack never appears across devices — sessionStorage may persist unexpectedly on some browsers/devices, or the "show once" mechanism fires on the first visit due to pre-existing sessionStorage state.

### 2. Home-Page Performance Lag (Device-Dependent)
- **File**: `src/pages/Pages.tsx:16-21` (HomePage function), `WelcomeBack.tsx:26-47`
- On mount, the Home page runs `useEffect(load, [])` which fetches `Promise.allSettled([getCatalog('movie'), getCatalog('series'), getHistory(), getWatchlist()])` in parallel. Meanwhile, `WelcomeBack` mounts and its `useEffect` runs, setting up sessionStorage checks and two timers (2200ms fade, 3000ms hide).
- **Main-thread contention**: Both the data fetch and WelcomeBack's effects + timers execute on the same main thread. On devices with slower JavaScript engines (certain iOS versions, lower-end ARM chips) or less main-thread capacity, the concurrent effects cause layout jank and delayed rendering.
- The Lenovo device likely has a more performant browser/JavaScript context, masking the contention.
- Even if WelcomeBack never visually appears, the component still mounts, its `useEffect` runs, and its timers fire — this "wasted" work contributes to the performance asymmetry.

### 3. The Issues Are Coupled
- If WelcomeBack's sessionStorage check fails (visible stays `false`), the component still mounts and runs its `useEffect`, setting sessionStorage and timers that immediately cancel. This adds work without rendering benefit, worsening the performance profile on constrained devices.

## Evidence
- `WelcomeBack.tsx:21`: `() => sessionStorage.getItem('ev0l-welcome-shown') !== '1'` — `null !== '1'` is `true` in JS, but depends on sessionStorage state.
- `WelcomeBack.tsx:27-28`: `if (sessionStorage.getItem('ev0l-welcome-shown') === '1') { setVisible(false); return }` — second check overrides initial state.
- `Pages.tsx:18-19`: `useEffect(load, [])` + `Promise.allSettled` fetches on every Home-page mount.
- `Pages.tsx:68-89`: WelcomeBack rendered as `<WelcomeBack item={history[0]} />` — if `history` is empty, `item` is `undefined`, and component returns null at line 49.

## Recommendations
1. **Add defensive check**: Wrap `sessionStorage.getItem` in a try/catch or null-coalesce to handle unexpected values.
2. **Debug sessionStorage**: Verify whether `ev0l-welcome-shown` persists across browser restarts or devices (it should be tab-scoped and cleared on tab close).
3. **Reduce main-thread impact**: Consider moving WelcomeBack's `useEffect` logic deferred (e.g., `useEffect` with a delay) or separating the "show once" check from the render-critical path.
4. **Profile on target devices**: Use Chrome DevTools Performance tab on an Acer laptop to capture the mount timeline and confirm the overlap between data fetch and WelcomeBack effects.