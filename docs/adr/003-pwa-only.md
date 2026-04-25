# ADR 003 — PWA-only distribution (no native wrapper)

**Date:** 2026-04-22  
**Status:** Accepted

## Context

The tool needs to work offline and, optionally, feel like a native app when installed. Two broad approaches exist: a PWA served from a static host, or a native wrapper (Tauri, Electron) that bundles the web app in a native shell.

## Decision

Ship **PWA-only** for v1. No Tauri or Electron binary.

## Alternatives considered

| Option | Reason rejected |
|---|---|
| Electron | Adds ~150 MB to the distributable, requires platform-specific build pipelines (code signing, notarization on macOS), and auto-update infrastructure. Overhead is disproportionate for a single-page tool with no native OS integration requirements. |
| Tauri | Smaller than Electron but still requires a Rust toolchain, per-platform build matrix, and app-store or direct-download distribution. Meaningful operational cost for a v1. |
| Native file system API | The PWA File System Access API (Chrome/Edge) covers the main use case (open/save `.json`). Where it's not available the app falls back to standard `<input type="file">` + `URL.createObjectURL` download — good enough for v1. |

## Consequences

- `npm run build` produces a `dist/` folder that any static host (GitHub Pages, Netlify, local `npx serve`) can serve.
- `vite-plugin-pwa` generates a `manifest.webmanifest` and Workbox service worker that precache the app shell, satisfying the "offline after first load" requirement.
- Maskable icons at 192 px and 512 px are provided so the installed PWA icon renders correctly on Android adaptive-icon and iOS home screen.
- If a user later requires native OS integration (file-system watch, tray icon, protocol handler), Tauri remains the preferred upgrade path — the web codebase needs no changes.
