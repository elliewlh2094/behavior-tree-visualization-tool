# ADR 008 — Theme ownership split by route (landing follows OS, editor is user-controlled)

**Date:** 2026-06-24
**Status:** Accepted

## Context

v1.11 added a landing page (`#/`, ADR 006) alongside the editor (`#/editor`). The pre-existing theme system was built for a single-view app: `App.tsx` called `useTheme()` (toggles the `.dark` class on `<html>`) and `usePreferencesSync()` (writes per-kind color CSS vars) once, globally, so **both** routes shared one resolved theme — the user's saved editor preference (`'light' | 'dark' | 'system'`, persisted to localStorage, default `'light'`).

Smoke testing surfaced that this is wrong for a landing page. A marketing-style landing page conventionally follows the visitor's OS/browser (`prefers-color-scheme`) and exposes no theme control — it is not a workspace the user configures. Applying the saved *editor* preference to the landing page is surprising: a user who set the editor to Dark would see a Dark landing page even though the landing page offers no way to change it, and a first-time visitor would get the old hard-coded `'light'` default rather than their OS theme.

The desired behavior:
- **Landing (`#/`)** — follows the OS/browser only; no user control.
- **Editor (`#/editor`)** — defaults to following the OS, but the user can override to Light/Dark in Settings, and that choice persists.

Two coupled constraints make this non-trivial: (1) the `.dark` class is global (one `<html>`), so "different theme per route" means whichever route is mounted must own the class; and (2) an inline FOUC script in `index.html` resolves the theme *before* React mounts to avoid a flash, so it must agree with React on the per-route rule.

## Decision

1. **Split theme ownership by route instead of hoisting it to `App`.**
   - `App` no longer calls `useTheme()` / `usePreferencesSync()`.
   - `EditorRoute` calls `useTheme()` + `usePreferencesSync()` — the editor honors the saved preference and mirrors node color families.
   - `LandingPage` calls a new `useSystemThemeClass()` — applies the `.dark` class from the OS theme only, ignoring the saved preference.

   HashRouter mounts exactly one route at a time, so the mounted route's effect deterministically owns the `.dark` class; navigating swaps owners. No coordination flag is needed.

2. **Extract `useSystemTheme()` from `useResolvedTheme()`.** `useSystemTheme()` returns the live OS theme (one `matchMedia` subscription). `useResolvedTheme()` (editor) layers the saved preference on top, resolving `'system'` through `useSystemTheme()`. Landing uses `useSystemTheme()` via `useSystemThemeClass()`. One subscription source, two consumers.

3. **Change the default preference `'light'` → `'system'`.** A brand-new editor visitor now follows their OS theme; Settings still lets them pin Light/Dark. Existing users keep their persisted choice (the default only applies when nothing is stored).

4. **Make the FOUC script route-aware.** It reads `window.location.hash`: for `#/editor` it reads the persisted preference (default `'system'`); for the landing page (and anything else) it forces `'system'`. Either way it resolves `'system'` via `matchMedia` before paint, matching what React applies on mount.

## Alternatives considered

| Option | Reason rejected |
|---|---|
| **Keep global theming in `App`, branch on the current route inside the hook** | Requires the theme hook to read the router location and special-case the landing path — more coupling than letting each route own its own effect. HashRouter already guarantees one mounted route, so per-route ownership is simpler and has no flag to keep in sync. |
| **Landing has its own theme toggle too** | Contradicts the goal: the landing page is a front door, not a configurable workspace. Conventional web landing pages follow the OS and offer no switch. Adds UI and persistence questions for no real benefit. |
| **Leave the default at `'light'`** | A first-time visitor on a dark-themed OS would get a light editor, ignoring their system preference. `'system'` is the least-surprising default and matches the landing page's behavior, so the two routes agree for a fresh user. |
| **Drop the FOUC script / let React fix the class after mount** | Reintroduces a flash of the wrong theme on first paint and on reload — the exact problem the FOUC script exists to prevent. Keeping it (route-aware) preserves no-flash on both routes. |

## Consequences

- **`usePreferencesSync()` runs only in the editor.** The landing page never reads node color CSS vars, so not setting them there is harmless; they're set when the editor mounts (including a direct `#/editor` load).
- **The FOUC script and React share one rule** ("landing → system; editor → persisted, default system"). Any future change to that rule must be made in both places or the first paint will flash.
- **Live OS switches still work on both routes** via the shared `matchMedia` subscription in `useSystemTheme()` — flipping the OS theme updates the landing page without a reload, and the editor when in `'system'` mode.
- **`useResolvedTheme()` is now editor-scoped.** Components that read it (Toolbar, Canvas) are only mounted in the editor, so they continue to reflect the user's preference; the landing page must use `useSystemThemeClass()` / `useSystemTheme()` instead.
- **Out of original v1.11 scope.** This change came from FR6 smoke-test feedback, not the v1.11 task plan. Recorded here so the deviation from "theme applies globally" is traceable.
