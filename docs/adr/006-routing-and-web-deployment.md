# ADR 006 — HashRouter routing + GitHub Pages web deployment

**Date:** 2026-06-22
**Status:** Accepted

## Context

Through v1.10 the app was a single editor view with no router (`App.tsx` toggled a `StartScreen` via a boolean), and the only way to run it was a local clone. v1.11 (`docs/SPEC-v1.11.md`) adds a marketing-style landing page that links into the editor, and ships the app at a public URL so visitors can try it in a browser without a domain purchase.

This forces two coupled decisions: how to route between landing (`#/` or `/`) and editor (`/editor`), and how/where to host. The hosting target is **GitHub Pages project site** at `https://elliewlh2094.github.io/behavior-tree-visualization-tool/` — i.e. the app lives under a **subpath**, not a domain root. Pages also has no server-side rewrite, so deep links to client routes 404 unless mitigated. The app is a PWA (ADR 003), so routing must not break the service worker.

## Decision

1. **Routing:** adopt `react-router-dom` with **HashRouter** — `#/` landing, `#/editor` editor. First router dependency in the project.
2. **Hosting:** **GitHub Pages**, auto-deployed by a GitHub Actions workflow on push to `main` (`configure-pages` → `upload-pages-artifact` → `deploy-pages`).
3. **base:** `vite.config.ts` sets `base` to `/behavior-tree-visualization-tool/` for `build`, `/` for `dev`.

## Alternatives considered

| Option | Reason rejected |
|---|---|
| **BrowserRouter** (clean `/editor` URLs) | On a Pages project site, directly loading or refreshing `/.../editor` returns 404 before the SW is installed (no server rewrite). The standard fix — a `404.html` that redirects into `index.html` — is a fragile hack. HashRouter avoids the problem entirely: the hash never reaches the server or the SW. |
| **No router** (keep the boolean state machine, gate landing vs editor in state) | No shareable editor URL, no browser back/forward between landing and editor, and the landing page couldn't be linked directly. The router cost is small and buys real navigation semantics. |
| **Netlify / Vercel** hosting | Both support SPA rewrites (BrowserRouter-friendly) and root-path hosting, but add an external account/service. GitHub Pages needs no new account (the repo is already on GitHub) and meets the "no domain purchase" goal. Revisit if clean URLs become a requirement. |
| **`base: './'` (fully relative)** | Works for assets but interacts awkwardly with some Vite/PWA path resolution; an explicit subpath `base` is clearer and is what `start_url`/`scope: '.'` already assume. |

## Consequences

- **Asset paths must be base-aware.** Absolute `/asset` references (`index.html` icons, `Toolbar`/`StartScreen` logos) 404 under the subpath base. They migrate to `import.meta.env.BASE_URL` (or static `import`). This is the highest-risk item in v1.11 — it silently breaks the live logo/PWA icons if missed.
- **PWA is unaffected.** The hash fragment is invisible to the service worker, so SW routing/precaching is unchanged. `manifest.start_url`/`scope` stay `'.'` (relative), which already resolve correctly under the subpath.
- **`npm run dev` stays at `/`** (base is build-only), so local development is unchanged.
- **URLs carry a `#`** (`…/#/editor`). Accepted trade-off for a free, domain-less, 404-proof deploy. If clean URLs are later required, the upgrade path is BrowserRouter + a host with SPA rewrites (Netlify/Vercel) or a Pages `404.html` redirect — the routing code changes minimally (swap the Router component).
- **Deploys are automatic** on push to `main`; the lockfile (with `react-router-dom`) must be committed for CI `npm ci` to succeed.
