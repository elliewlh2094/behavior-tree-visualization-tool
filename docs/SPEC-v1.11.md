# Spec: Behavior Tree Visualization Tool — v1.11 "Web Presence & Discoverability"

> Roadmap entry: `docs/tasks/roadmap.md` §v1.11. Task breakdown: `docs/tasks/v1.11-todo.md`. Refined idea inventory: `docs/ideas/v1.11-web-presence-batch.md`. Routing/deploy decision: `docs/adr/006-routing-and-web-deployment.md`.
> Added 2026-06-22 from a 4-idea user batch ("make the project easier to use"), modeled on jsoncrack.com.
> Status: **DRAFT — awaiting human approval.**

## Objective

Lower the barrier to first use. Today the only way to run the tool is `git clone` + `npm`, and launching drops the user straight into the editor. v1.11 makes the tool **openable in a browser at a public URL** with a **polished landing page** (jsoncrack.com model), and adds four in-editor usability wins surfaced by surveying high-star OSS visualization tools (jsoncrack, Excalidraw, tldraw, React Flow, Rete.js, Groot2). Local clone remains supported but is demoted to a secondary path in the README.

**Users:** robotics engineers and students learning behavior trees — including first-time visitors who want to try the tool before committing to a clone.

**Success looks like:** a visitor opens `https://elliewlh2094.github.io/behavior-tree-visualization-tool/`, understands what the tool is from the landing page, clicks through to the editor, can search a large tree, navigate it via minimap, start from an example template, and is warned before losing unsaved work.

## Tech Stack (delta from v1.10)

- **New dependency:** `react-router-dom` (HashRouter). First router in the project. See AD7.
- **New CI:** GitHub Actions → GitHub Pages (`actions/configure-pages`, `upload-pages-artifact`, `deploy-pages`).
- Everything else unchanged: React + TS + Vite + `@xyflow/react` + Zustand + Tailwind + `vite-plugin-pwa`.

## Commands

```
Dev:        npm run dev          # http://localhost:5173, base '/', no PWA SW
Build:      npm run build        # tsc -b && vite build, base '/behavior-tree-visualization-tool/'
Preview:    npm run preview      # serves dist/ with PWA SW (may serve stale bundle)
Preview-dev:npm run preview:dev  # serves dist/ with PWA disabled
Typecheck:  npm run typecheck
Lint:       npm run lint
Unit tests: npm run test:ci
E2E tests:  npm run test:e2e
```

## Project Structure (new/changed paths)

```
src/App.tsx                         → HashRouter + Routes (was boolean state machine)
src/routes/EditorRoute.tsx          → NEW: editor shell (canvas + ReactFlowProvider); StartScreen retired
src/components/landing/LandingPage.tsx → NEW: marketing-style intro page (#/)
src/components/canvas/SearchBox.tsx → NEW: floating Ctrl+F search bar
src/templates/{index,patrol,chase}.ts → NEW: serialized example trees + registry
src/hooks/useDirtyTracking.ts       → NEW: document-reference → dirty flag
src/hooks/useBeforeUnload.ts        → NEW: native unload guard when dirty
src/hooks/useLoadTemplate.ts        → NEW: deserialize template → setDocument (reuses useFileOpen path)
.github/workflows/deploy.yml        → NEW: Pages CI
vite.config.ts                      → base per command; PWA scope unchanged
index.html, Toolbar.tsx              → asset paths via import.meta.env.BASE_URL
```

## Code Style

Match existing conventions. Base-aware asset reference (the v1.11-specific idiom):

```tsx
// GOOD — resolves to '/' in dev, '/behavior-tree-visualization-tool/' in build
<img src={`${import.meta.env.BASE_URL}${theme === 'dark' ? 'icon-dark.svg' : 'icon.svg'}`} />

// BAD — 404s under a subpath base
<img src="/icon.svg" />
```

`setCenter` must always pass `zoom` explicitly (omitting it snaps zoom to 1.0 — see `docs/v1.3-color-reference.md` history / memory):

```ts
const { setCenter, getZoom } = useReactFlow();
setCenter(node.position.x + NODE_WIDTH / 2, node.position.y + NODE_HEIGHT / 2,
          { zoom: getZoom(), duration: 200 });
```

## Testing Strategy

- **Unit (Vitest):** `tests/unit/...` — template deserialization round-trips; dirty-flag transitions (mutate→dirty, save→clean, open→clean, no-op→clean); search filter (case-insensitive, current-tree only); `markSaved` clears flag.
- **Component (Vitest):** `tests/unit/components/...` — SearchBox match count + next/prev; LandingPage CTA navigation.
- **E2E (Playwright):** `e2e/...` — landing → editor route; Ctrl+F search + Enter-to-center; minimap renders; template load; dirty title marker + (where testable) beforeunload.
- **No regression** to the 441 unit / 48 e2e baseline; new tests are additive.

## Boundaries

- **Always:** run `typecheck` + `lint` + `test:ci` before each commit; reference assets via `import.meta.env.BASE_URL` or `import`; pass `zoom` explicitly to `setCenter`; keep PWA `start_url`/`scope` as `'.'`.
- **Ask first:** adding `react-router-dom` (AD7 — approved in this spec); any change to PWA manifest `start_url`/`scope`; changing the file-format schema.
- **Never:** self-tick manual-smoke checkboxes (human-run; automation only adds `_Evidence:_`); push to `main` before lockfile (with `react-router-dom`) is committed; deploy with absolute `/asset` paths unfixed (would break the live logo/PWA icons).

---

## Feature Specs

### FR3 — Landing Page + Routing

**What:** A jsoncrack-style intro page at `#/` with a hero (title, subtitle, "Go to Editor" CTA), a feature highlight section, and a product screenshot. The editor moves to `#/editor`. Routing uses **HashRouter** (AD7).

> **Revision (post-Checkpoint-A review):** the original design kept the `StartScreen` (New Tree / Open File) as the editor route's initial in-route state. User feedback found that intermediate screen redundant once a landing page exists: the LandingPage already owns brand/entry, the store seeds an empty single-Root document, and the Toolbar already has an "Open" action. **`StartScreen` is retired** — `#/editor` drops straight onto the canvas. `StartScreen.tsx`, its unit test, and `e2e/start-screen.spec.ts` were removed; editor e2e specs no longer dismiss a start screen.

**Acceptance criteria:**
- `#/` renders `<LandingPage>`; `#/editor` renders the editor shell.
- LandingPage hero CTA navigates to `#/editor`.
- `#/editor` drops directly onto the canvas (store-seeded single-Root document); opening an existing file is the Toolbar's "Open" action. No intermediate start screen.
- `ReactFlowProvider` wraps only `#/editor`, not the landing page.
- Theme/preferences apply on both routes (hooks hoisted to `App`).
- Direct-loading `#/editor` and refreshing works (HashRouter needs no server rewrite).
- LandingPage is responsive (does not break at mobile width) and dark-mode compatible.

**Scope:** M. **Files:** `src/App.tsx`, `src/routes/EditorRoute.tsx` (new), `src/components/landing/LandingPage.tsx` (new), `package.json`. _Removed: `src/components/start-screen/`, `tests/unit/components/StartScreen.test.tsx`, `e2e/start-screen.spec.ts`._

### FR5 — GitHub Pages Deployment

**What:** Ship the PWA to GitHub Pages so anyone can open it in a browser without a domain purchase. Auto-deploy on push to `main`.

**Acceptance criteria:**
- `vite.config.ts` sets `base: command === 'build' ? '/behavior-tree-visualization-tool/' : '/'`. `npm run dev` stays at `/`.
- All previously-absolute asset paths (`index.html` icons, `Toolbar.tsx`, `StartScreen.tsx`, any LandingPage assets) resolve under the subpath base (via `import.meta.env.BASE_URL` or static `import`) — **no 404s online.**
- PWA `start_url`/`scope` remain `'.'`; `navigateFallback` resolves under base. Offline reload of the deployed app works.
- `.github/workflows/deploy.yml`: triggers on `push` to `main` + `workflow_dispatch`; permissions `pages: write`, `id-token: write`; concurrency group `pages`; Node 20; `npm ci` → `npm run build` → `configure-pages`/`upload-pages-artifact`(`dist`)/`deploy-pages`.
- README leads with the live URL; clone/local instructions demoted to a secondary section.

**Scope:** S–M. **Files:** `vite.config.ts`, `index.html`, `src/components/toolbar/Toolbar.tsx`, `src/components/start-screen/StartScreen.tsx`, `.github/workflows/deploy.yml` (new), `README.md`.

### FR6 — Node Search (Ctrl+F)

**What:** A floating search bar (jsoncrack model) summoned by Ctrl+F over the canvas. Filters nodes in the **active tree** by name substring (case-insensitive), highlights matches, and steps through them centering each.

**Acceptance criteria:**
- Ctrl+F (when focus is not in an editable field) opens the floating SearchBox and `preventDefault`s the browser's in-page find.
- Typing filters active-tree nodes by `name.toLowerCase().includes(query)`; matches get a distinct highlight (amber ring), **not** reusing the selection visual.
- A counter shows `current/total` (e.g. `2/5`), labeled "(current tree)".
- Enter / ↓ moves to the next match; Shift+Enter / ↑ to the previous; the current match is centered via `setCenter(..., { zoom: getZoom(), duration: 200 })` — zoom is preserved.
- Esc closes the box and clears highlights.
- Search state is transient (not in undo/redo history).
- Cross-tree search is **out of scope** for v1.11 (active tree only).

**Scope:** M. **Files:** `src/store/bt-store.ts` (transient `searchOpen`, `searchMatchIds`), `src/components/canvas/SearchBox.tsx` (new), `src/components/canvas/Canvas.tsx`, `src/components/canvas/BTNode.tsx`, `src/components/toolbar/Toolbar.tsx`.

### FR7 — Minimap

**What:** React Flow's built-in `<MiniMap>` for navigating large trees.

**Acceptance criteria:**
- MiniMap renders on the canvas; `nodeColor` aligns with per-kind `BTNode` colors; `maskColor`/`bgColor` align with the active theme (light/dark).
- MiniMap is hidden during image export (`exportInProgress`), like the AxisOverlay/OriginCross.

**Scope:** XS. **Files:** `src/components/canvas/Canvas.tsx`.

### FR8 — Example Templates

**What:** Ship a small set of example trees a user can start from, so students get a working tree immediately.

**Acceptance criteria:**
- At least two templates (Patrol, Chase) stored as serialized v2-schema JSON strings under `src/templates/`, with a registry (`{ id, name, description, json }`).
- A "Start from a template" entry on the LandingPage loads a template via the existing `deserialize → setDocument → setFileName` path, then routes to `#/editor`.
- After load: the tree validates clean, `fileName` reflects the template, and `dirty` is `false` (templates are an "opened document", not an unsaved edit).

**Scope:** S. **Files:** `src/templates/{index,patrol,chase}.ts` (new), `src/hooks/useLoadTemplate.ts` (new), `src/components/landing/LandingPage.tsx`.

### FR9 — Unsaved-Changes Guard

**What:** Because saving is a manual Ctrl+S Blob download with no autosave, warn users before they lose unsaved edits. Track a **dirty** flag and surface it.

**Acceptance criteria:**
- New store state `dirty: boolean` (default `false`) plus `lastSavedDocument`. Dirty is set by a subscription that fires when the `document` object **reference** changes away from `lastSavedDocument` (covers every mutating action, including the non-`withSnapshot` ones — `moveNode`, `reorderChildren`, `updateNodeName`; a no-op `return {}` keeps the same reference so it does **not** falsely set dirty).
- `markSaved()` (called after a successful save) and `setDocument` (open/template load) clear dirty and reset `lastSavedDocument`.
- When dirty: `document.title` is prefixed with `● ` and the filename field shows a small dot indicator.
- When dirty: `beforeunload` triggers the browser's native "leave site?" prompt; when clean, it does not.
- Undo/redo that changes the document reference marks dirty — this is correct (state differs from last save).

**Scope:** S–M. **Files:** `src/store/bt-store.ts`, `src/hooks/useDirtyTracking.ts` (new), `src/hooks/useBeforeUnload.ts` (new), `src/components/toolbar/Toolbar.tsx`, `src/App.tsx` (title hook).

---

## Success Criteria (release-level, testable)

1. Live URL serves the landing page with no 404 assets; CTA reaches `#/editor`; refreshing `#/editor` works.
2. Ctrl+F search highlights + centers matches with zoom preserved; Esc closes; browser find is suppressed.
3. Minimap renders, theme-consistent, absent from exported PNGs.
4. A template loads into a clean, valid tree with `dirty=false`.
5. Editing sets the `●` title marker + arms beforeunload; Save clears both.
6. `npm run typecheck && npm run lint && npm run test:ci && npm run test:e2e` all green; GitHub Actions deploy succeeds.
7. Lighthouse ≥ v1.10 baseline (no regression from router + landing page).

## Resolved Questions (confirmed by user 2026-06-22)

- **Landing copy + screenshot:** placeholder copy + existing README screenshots for the first pass; visual + copy details refined after browser review.
- **Template count:** start with 2 (Patrol, Chase); expand once the flow is proven.
- **Dirty indicator form:** ship **both** — the `● ` title-prefix (tab/window level, cross-tab visible) **and** the toolbar filename dot (in-app, bound to the filename). The `beforeunload` native prompt ships regardless. Both clear together on save.
