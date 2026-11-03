# Roadmap: Behavior Tree Visualization Tool

> Plan index: the in-progress release, dropped and deferred features, and the key architectural decisions (AD table).

## v1.11 "Web Presence & Discoverability"

> Full spec: `docs/SPEC-v1.11.md`. Task breakdown: `docs/tasks/v1.11-todo.md`. Routing/deploy decision: `docs/adr/006-routing-and-web-deployment.md`.
> Added 2026-06-22 from a 4-idea user batch ("make the project easier to use"), modeled on jsoncrack.com.
> **Status: Implementation complete — awaiting human sign-off.** All 13 in-scope tasks landed (T11 minimap descoped, AD9). Commits: `ce96035` (spec/roadmap/todo/ADR), `8674190` (T1–T3 base + assets + Pages deploy), `ceab9f1` (T4–T5 HashRouter + LandingPage; StartScreen retired), `b2798d7` (T6–T7 dirty marker + beforeunload), `80901f1` (T8–T10 search), `1c50303` (theme defaults), `bb009e0` (T11 minimap, later reverted), `d865397` (descope FR7, AD9), `787a84a` (canvas-controls redraw fix), `32d06a3` (T12–T13 templates + T7b–T7c unified unsaved guard, AD10). Final checks (HEAD `32d06a3`): typecheck green; lint 0 errors; **490 unit** (44 files) + **62 e2e** green; build green (precache 11 entries, 635.45 KiB). Remaining: T14 docs + the user-run manual smokes / Lighthouse / sign-off in `docs/tasks/v1.11-todo.md`.

**Objective:** Lower the barrier to first use. Make the tool openable in a browser at a public URL with a polished landing page (jsoncrack.com model); keep local clone as a secondary path. Plus four in-editor usability wins distilled from an OSS survey (jsoncrack, Excalidraw, tldraw, React Flow, Rete.js, Groot2), filtered against features the app already ships (auto-layout, undo/redo, image export, dark theme, validation, multi-tree).

Two phases. **Phase A — Web Distribution** lands first; its A0 sub-step (asset paths + `base`) is the highest-risk item because a subpath `base` silently breaks every absolute `/asset` reference (fail-fast).

### Phase A — Web Distribution

- **FR3 — Landing page + routing.** New `LandingPage` at `#/` (hero + CTA + feature highlights + screenshot); editor moves to `#/editor`. Adopts `react-router-dom` (migrated to the **data router** `createHashRouter`/`RouterProvider` in T7b so `useBlocker` is available — AD7/AD10). **Revised:** the old `StartScreen` was **retired** — `#/editor` drops straight onto the canvas (store-seeded single Root) and Toolbar "Open" handles existing files.
- **FR5 — GitHub Pages deployment.** Auto-deploy via GitHub Actions on push to `main`. `vite.config.ts` `base` = `/behavior-tree-visualization-tool/` for build, `/` for dev. Absolute asset paths migrate to `import.meta.env.BASE_URL`. PWA `start_url`/`scope` stay `'.'`. README leads with the live URL.

### Phase B — In-Editor Usability

- **FR6 — Node search (Ctrl+F).** Floating search bar (jsoncrack model); case-insensitive name filter over the active tree; amber-ring highlight (distinct from selection); `n/m` counter; Enter/↓ next, Shift+Enter/↑ prev, centering each via `setCenter(..., { zoom: getZoom() })`; Esc closes. Transient state, not in history. Cross-tree search out of scope.
- ~~**FR7 — Minimap.**~~ **DEFERRED 2026-06-25** (AD9). Built and verified (commit `bb009e0`), then removed before ship: xyflow's built-in `<MiniMap>` shows only color blocks (no labels/connections), conveying little for a behavior tree, and overlaps with FR6 search. Implementation preserved in git history; revisit on user demand or a custom label/edge-rendering minimap. See `docs/adr/009`.
- **FR8 — Example templates.** Serialized v2-schema tree in `src/templates/*.ts`, loaded via the existing `deserialize → setDocument` path; "Or start from a template" entry on the landing page. **Revised:** ships **Chase only** — Chase bundles the **Patrol** tree as a `SubTree`, so a standalone Patrol card was redundant and dropped.
- **FR9 — Unsaved-changes guard.** New `dirty` flag tracked by `document`-reference comparison vs `lastSavedDocument` (covers non-`withSnapshot` mutations; no-ops keep the reference so no false positives). Drives a `●` title/filename marker. **Revised (AD10):** the guard seam moved from "next overwrite" to **leaving the editor canvas** — in-app navigation is blocked via `useBlocker` and every app-controllable discard (Back, Open) shares one custom `UnsavedChangesModal`; only tab close/refresh stays on the native `beforeunload` prompt. Cleared by `markSaved()` (save) and `setDocument` (open/template).

**Out of scope (v1.11):** cross-tree search; BrowserRouter/clean URLs; command palette + context menu (surveyed, user-deferred); autosave/localStorage document; custom domain; BT-format interop (FR4 stays deferred).

**Estimated scope:** M–L. 14 tasks. Phase A0 critical path T1→T2→T3 (deploy foundation); Phase A T4→T5 (router + landing); Phase B parallelizable: {T6→T7} dirty, {T8→T9→T10} search, T11 minimap, {T12→T13} templates; T14 docs + ship.

**Dependencies:** v1.10 complete (Toolbar/TabBar/Canvas layout finalized). FR8's UI entry depends on FR3's router/landing; FR9 is independent.

---

## Dropped Features

### F17 — Reusable Node Templates (DROPPED 2026-05-11)

Originally targeted v2.0. Dropped per user decision after v1.4's SubTree references (F13) shipped — the *edit-once-applies-everywhere* case is well-served by SubTree refs, and the *fork-and-diverge* case is well-served by v1.5 duplicate + (planned) v1.10 Copy. The novel template-registry abstraction no longer feels compelling for the cost.

**AD5 retired** — no longer a load-bearing roadmap decision.

---

## Deferred (Not Scheduled)

### FR4 — Interop with External BT Formats

User request 2026-05-11. Import/export to BehaviorTree.CPP XML, Groot, etc. Each format is a substantial spec on its own. No urgent user pull; revisit if demand grows.

### FR7 — Minimap (DEFERRED 2026-06-25)

Built and verified in v1.11 (commit `bb009e0`), then removed before ship (AD9, `docs/adr/009`). xyflow's built-in `<MiniMap>` renders only color blocks — no labels or connections — so it conveys little for a top-down behavior tree, and the "find a node" need it might serve is already covered by FR6 search. Revisit trigger: real user feedback that large trees are hard to navigate, or a custom minimap node component that renders labels/edges. The working implementation is recoverable from git history.

---

## Key Architectural Decisions

| ID | Decision | Release | Rationale |
|----|----------|---------|-----------|
| AD1 | Preferences in separate Zustand store with `persist` middleware | v1.3 | Different lifecycle from tree data — persisted, no undo/redo, survives tree changes |
| AD2 | CSS custom properties for all theme-able colors | v1.3 | Runtime-changeable without re-renders; supports dark mode toggle |
| AD3 | Custom recursive tree layout, no dagre/elkjs | v1.2 | BT is strict hierarchy; ~100 lines vs 8–130KB dependency |
| AD4 | `BehaviorTree` → `BTDocument` model, file format v2 | v1.4 | Enables subtree references and multi-tree documents |
| ~~AD5~~ | ~~Reusable node templates deferred to v2.0~~ — **RETIRED 2026-05-11** | — | F17 dropped from roadmap; SubTree refs + Copy cover the use cases |
| AD6 | Unified-timeline undo/redo (single chronological `RingBuffer<DocSnapshot>`); tabs are pure UI projection | v1.7.1 | Replaces v1.7's per-tree + global dual-stack model after smoke testing exposed UI teleport, max-seq merge gaps, and stale-snapshot issues |
| AD7 | HashRouter routing + GitHub Pages subpath deployment (`base` build-only); assets via `import.meta.env.BASE_URL` | v1.11 | Pages project sites 404 BrowserRouter deep links and host under a subpath; hash is 404-proof and invisible to the PWA service worker. Full rationale in `docs/adr/006`. |
| AD8 | Theme ownership split by route — landing follows OS (`prefers-color-scheme`, no control); editor user-controlled, default `system` | v1.11 | FR6 smoke feedback: a landing page should follow the visitor's OS, not the saved editor preference. Per-route effects own the `.dark` class; route-aware FOUC script. Full rationale in `docs/adr/008`. |
| AD9 | Minimap (FR7) descoped from v1.11; implementation kept in git history (commit `bb009e0`), not as dead/commented code | v1.11 | Built-in `<MiniMap>` shows only color blocks (no labels/connections) — little value for a top-down BT, and overlaps with FR6 search. Revisit on user demand or a custom label/edge minimap. Full rationale in `docs/adr/009`. |
| AD10 | Unsaved-changes guard unified on one custom modal for every **app-controllable discard**: data-router migration (`createHashRouter`/`RouterProvider`) + `useBlocker` for in-app nav (Back); `requestDiscard` context + `useDiscardGuard` routes Open through the **same** modal (parameterized copy); `beforeunload` keeps covering close/refresh (native, the only non-unifiable case); New Tree / delete-tree deliberately not guarded (undoable, non-discarding); landing-page guards removed | v1.11 | Checkpoint-B feedback: `beforeunload` misses SPA Back; guard belongs at "leaving the canvas / replacing the document". One themed modal for all app-internal discards. Full rationale in `docs/adr/010`. |
