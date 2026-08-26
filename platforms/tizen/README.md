# EV0L for Samsung Tizen

This directory is a separate Tizen TV application. It does not modify or replace the existing Windows/LAN EV0L application in the repository root.

## Goals

- Samsung Tizen TV web application using Vite.
- Relative asset routing so the generated package can be opened from a local `.wgt` package.
- Remote-friendly 10-foot UI.
- Native HTML5 media playback where possible.
- Stalker Portal as a dedicated IPTV source adapter.
- Optional connection to the existing EV0L LAN API in the future.

## Development

```powershell
cd platforms/tizen
npm install
npm run dev
```

## Build

```powershell
npm run build
```

The build output is intended to be packaged by the Tizen CLI into a `.wgt` web application package.

## First milestone

1. Boot a clean Tizen shell on the TV.
2. Verify remote navigation/focus behavior.
3. Verify network access and relative asset loading.
4. Add Stalker Portal configuration and authentication.
5. Add HLS playback and EPG.
6. Add optional EV0L LAN connectivity.
