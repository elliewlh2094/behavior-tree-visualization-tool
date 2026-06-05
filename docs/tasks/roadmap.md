# Roadmap: Behavior Tree Visualization Tool — v1.1 through v2.0

> Master plan for all post-v1.0 releases. Derived from 17 user ideas collected after v1.0 launch, plus a v1.7.1-fallout batch of 3 bugs + 4 UX papercuts + 2 features added 2026-05-11.
> Status: **Approved — 2026-04-26 (original); v1.8/v1.9/v1.10 batch approved 2026-05-11.**
> Last updated: 2026-06-03

## How to read this document

- **`roadmap.md` (this file)** — release themes, feature definitions, scope estimates, architectural decisions. Narrative.
- **`v1.1-todo.md`** — flat, checkable task list for the current release. Tactical. Created per-release when work begins.
- **`plan.md` / `todo.md`** — v1.0 plan and tasks (historical, completed).

Each release gets its own `vX.Y-todo.md` when implementation starts. This file is the source of truth for what goes into which release.

---

## Release Overview

| Release | Theme | Features | Effort | Risk |
|---------|-------|----------|--------|------|
| **v1.1** | Polish & Ergonomics | F1–F7 (7 features, 11 tasks) | M | Low |
| **v1.2** | Canvas Control | F8–F9 (2 features) | S–M | Low |
| **v1.3** | Theming & Preferences | F10–F12 (3 features) | L | Medium |
| **v1.4** | Subtrees & Composition | F13–F14 (2 features) | XL | High |
| **v1.5** | Multi-Select & Duplicate | F18 (1 feature) | S–M | Low |
| **v1.7** | Cross-Tree Undo | F19 (bug fix from v1.4 smoke) | S–M | Low |
| **v1.7.1** | Unified History Timeline | F19 redesign (v1.7 smoke surfaced UI, algorithm, and data-model defects) — SHIPPED 2026-05-10 | S–M | Low |
| **v1.6** | Repo Hygiene & Docs | F15–F16 (2 features) — SHIPPED 2026-05-10 | S–M | None |
| **v1.8** | SubTree Hardening & Canvas Polish | B1+B2 SubTree name non-editable, B3 PWA preview opt-out, FB1 Layout fits tree, FB2 zoom chip, FB4 Open Subtree button | S–M | Low |
| **v1.9** | Image Export | FR1 PNG export, transparent + themed modes | S | Low |
| **v1.10** | Cross-Tree Composition | FB3 tab drag-reorder, FR2 Move/Copy across tabs | M–L | Medium |
| ~~**v2.0**~~ | ~~Reusable Templates~~ | ~~F17 (1 feature, deferred)~~ — **DROPPED 2026-05-11** per user decision; the feature no longer feels compelling after SubTree refs (F13) shipped. AD5 retired. | — | — |

**Deferred (not scheduled):** FR4 — import/export to external BT formats (BehaviorTree.CPP, Groot). Nice-to-have, no urgent user pull; revisit if demand grows.

> **Numbering note:** v1.7/v1.7.1 shipped before v1.6 chronologically. The original v1.5 slot was Repo Hygiene; F18 was promoted into v1.5 when v1.4 Phase 2 made multi-selection trivial; Repo Hygiene became v1.6. F19 was assigned v1.7 (out of numerical order) when its v1.4-smoke-confirmed user-visibility outweighed v1.6's "low-risk breather" framing. v1.6 then shipped 2026-05-10 immediately after v1.7.1, before the v1.8–v1.10 batch was scoped on 2026-05-11.

## Dependency Map

```
v1.1 "Polish & Ergonomics" (in progress)
 │
 ├──► v1.2 "Canvas Control"
 │     │
 │     └──► v1.3 "Theming & Preferences"
 │           │
 │           └──► v1.4 "Subtrees & Composition"
 │                 │
 │                 └──► v1.5 "Multi-Select & Duplicate"
 │
 └──► v1.6 "Repo Hygiene & Docs" (no code deps — ran after v1.7.1)
```

Critical path through v1.7.1: v1.1 → v1.2 → v1.3 → v1.4 → v1.5 → v1.7 → v1.7.1. v1.6 was fully independent and shipped 2026-05-10 immediately after v1.7.1.

## Idea-to-Release Mapping

All 17 original user ideas, organized:

| # | Original Idea | Release | Feature ID |
|---|---------------|---------|------------|
| 3 | Toolbar branding (icon + name) | v1.1 | F1 |
| 4 | Bigger handles | v1.1 | F2 |
| 5 | File name display | v1.1 | F3 |
| 6 | File rename (click-to-edit) | v1.1 | F4 |
| 11 | Short IDs in property panel | v1.1 | F5 |
| 16 | Start screen (Photopea model) | v1.1 | F6 |
| 17 | Welcome UI design language (Level A) | v1.1 | F7 |
| 7 | Grid background toggle | v1.2 | F8 |
| 12 | Auto layout reorganization | v1.2 | F9 |
| 8 | UI customization (colors, thickness) | v1.3 | F10 |
| 9 | Save/load UI preferences | v1.3 | F11 |
| 10 | Dark mode | v1.3 | F12 |
| 13 | Subtree references | v1.4 | F13 |
| 14 | Multi-tab editing | v1.4 | F14 |
| 1 | README expansion | v1.6 | F15 |
| 2 | Repo root tidy | v1.6 | F16 |
| ~~15~~ | ~~Reusable node templates~~ | ~~v2.0~~ — DROPPED 2026-05-11 | ~~F17~~ |
| (post-launch) | Multi-select & duplicate | v1.5 | F18 |
| (v1.4 smoke bug) | Cross-tree mutation undo | v1.7 | F19 |
| (2026-05-11 user reports) | SubTree name editable / per-keystroke undo / preview SW cache | v1.8 | B1 / B2 / B3 |
| (2026-05-11 user feedback) | Layout fits tree / zoom display / Open subtree button | v1.8 | FB1 / FB2 / FB4 |
| (2026-05-11 user request) | Image export PNG | v1.9 | FR1 |
| (2026-05-11 user feedback + request) | Tab drag-reorder + cross-tree Move/Copy | v1.10 | FB3 / FR2 |
| (2026-05-11 user request, deferred) | Interop with BT.CPP / Groot formats | (unscheduled) | FR4 |

---

## v1.1 "Polish & Ergonomics" — IN PROGRESS

> Full spec: `docs/SPEC.md` §v1.1. Task breakdown: `tasks/v1.1-todo.md`.

**Objective:** Seven UI-focused improvements that make the app feel professional. Zero data model changes. One new asset class (self-hosted font files), zero new npm dependencies.

**Features:**
- **F1** — App branding (icon + "BT Visualizer" in toolbar)
- **F2** — Bigger handles (8×8 px, visible border, hover feedback)
- **F3** — File name display (right-aligned in toolbar, from Zustand store)
- **F4** — File rename (click-to-edit, Enter/Escape, .json enforced)
- **F5** — Short IDs in property panel (parent/children for nodes, source/target for edges)
- **F6** — Start screen (full-page welcome, "New Tree" + "Open File" CTAs)
- **F7** — Design language polish (Work Sans font, rounded-lg, shadow-subtle/card tokens)

**Phase 1 (DONE):** T1 shortId, T2 handles, T3 fileName store, T8 design tokens + font.
**Phase 2 (NEXT):** T4 toolbar branding, T6 property panel IDs, T9 start screen → T5 rename, T10 apply design → T7, T11 e2e tests.

**Key decisions:**
- Start screen state: local `useState` in App.tsx, not Zustand
- File-open logic: shared `useFileOpen` hook (Toolbar + StartScreen)
- Work Sans: self-hosted in `public/fonts/` (no CDN, per SPEC §Boundaries)

---

## v1.2 "Canvas Control"

**Objective:** Two canvas-level features that improve spatial authoring. Low risk, scoped to the Canvas component and one new core module.

### F8 — Grid Toggle

Show/hide the grid background. When hidden, only a light gray 50×50 px cross at the origin.

**Acceptance criteria:**
- Toggle button in toolbar switches grid visible/hidden
- Visible: current behavior (ReactFlow `Background`, Lines variant, 25px gap)
- Hidden: no grid lines; short cross at world-space origin `(0,0)` via AxisOverlay
- Snap-to-grid remains active regardless of grid visibility
- Grid state in Zustand (`showGrid: boolean`, default `true`), outside undo/redo
- Session-only persistence (cross-session persistence deferred to v1.3)

**Scope:** S
**Files:** `bt-store.ts`, `Canvas.tsx`, `Toolbar.tsx`

### F9 — Auto Layout

Automatic tree layout reorganization via toolbar button.

**Acceptance criteria:**
- "Layout" button triggers top-down tree repositioning
- Root at top, children below, siblings left-to-right by `order` value
- All positions snap to 25px grid
- Single undo step for the entire repositioning
- Orphaned nodes placed to the right of the main tree
- Canvas fits the new layout after applying (`fitView`)
- Connection `order` values NOT changed

**Layout engine:** Custom ~100-line recursive function in `src/core/layout/tree-layout.ts`. No dagre/elkjs dependency — BT is a strict hierarchy, not a general DAG.

```ts
export function computeTreeLayout(
  tree: BehaviorTree,
  options: { gridSize: number; nodeWidth: number; nodeHeight: number; gapX: number; gapY: number }
): Map<string, { x: number; y: number }>;
```

**Scope:** M
**Files:** `src/core/layout/tree-layout.ts` (new), `bt-store.ts`, `Toolbar.tsx`, `Canvas.tsx`, `tests/unit/core/layout/tree-layout.test.ts` (new)

**Order:** F8 first (smaller), then F9.
**Dependencies:** v1.1 complete (toolbar layout finalized, start screen in place).

---

## v1.3 "Theming & Preferences"

**Objective:** Full theming system: CSS custom properties, user-customizable colors, localStorage persistence, and dark mode.

### F10 — UI Customization

Settings panel for customizing colors and appearance.

**Acceptance criteria:**
- "Settings" button (gear icon) in toolbar opens settings modal/panel
- Customizable properties: canvas bg color, grid line color, node bg per kind, edge color, edge thickness (1–2.5px), node border thickness (1–2px)
- All driven by CSS custom properties (`--bt-canvas-bg`, `--bt-edge-color`, etc.)
- Color pickers present curated Tailwind palette (not free-form)
- Defaults match current hardcoded values exactly (backward compatible)
- Settings do NOT create undo/redo entries

**Key decision:** Separate `src/store/preferences-store.ts` (not in `bt-store.ts`). Different lifecycle: persisted to localStorage, never in undo/redo, survives tree open/close.

**Scope:** L
**Files:** `preferences-store.ts` (new), `SettingsPanel.tsx` (new), `ColorPicker.tsx` (new), `Canvas.tsx`, `BTNode.tsx`, `kind-visuals.ts`, `tailwind.css`, `Toolbar.tsx`

### F11 — Save/Load Preferences

Automatic localStorage persistence for all settings.

**Acceptance criteria:**
- All F10 settings auto-persisted to `localStorage` under `bt-visualizer-preferences`
- On load, preferences applied before first render (no flash of defaults)
- Corrupt/missing localStorage → silent fallback to defaults
- "Reset to defaults" button in settings panel
- Stored as versioned JSON for future migration

**Implementation:** Zustand `persist` middleware (~10 lines of config). Already available — Zustand is a dependency.

**Scope:** S

### F12 — Dark Mode

Full dark theme with manual + system toggle.

**Acceptance criteria:**
- Dark/light/system toggle in settings panel
- "System" follows `prefers-color-scheme` media query
- Manual choice overrides system preference
- Dark mode covers all UI: panels, canvas, nodes, start screen, settings
- Tailwind `dark:` variant with `class` strategy (toggle `dark` class on `<html>`)
- WCAG AA contrast in both modes
- Persisted via F11's localStorage

**Scope:** M–L
**Files:** `tailwind.config.ts`, `preferences-store.ts`, `SettingsPanel.tsx`, `App.tsx`/`main.tsx`, every component (add `dark:` variants), `tailwind.css`, `index.html` (inline script to prevent FOUC)

**Order:** F10 → F11 → F12 (each builds on the previous).
**Dependencies:** v1.1 complete (design tokens are the starting point for CSS variable migration). v1.2 recommended (grid toggle colors should be included in theming).

---

## v1.4 "Subtrees & Composition"

**Objective:** Subtree references and multi-tree editing. Most architecturally significant release — fundamentally changes the data model from a single tree to a multi-tree document.

### F13 — Subtree References

New `SubTree` node kind referencing another tree definition by name. Follows the Groot2/BehaviorTree.CPP pattern.

**Acceptance criteria:**
- New `SubTree` kind in `NODE_KINDS` (9 kinds total)
- `SubTree` is a leaf (no children) with a `treeRef: string` property
- Data model evolves to multi-tree document:
  ```ts
  interface BTDocument { version: 2; mainTreeId: string; trees: BTTreeDef[]; }
  interface BTTreeDef { id: string; name: string; rootId: string; nodes: BTNode[]; connections: BTConnection[]; }
  ```
- File format version bumps to 2; v1 files auto-migrate (single tree wrapped in document)
- New validation rules: R9 (treeRef references existing tree), R10 (no circular subtree refs)
- Property panel shows treeRef dropdown for SubTree nodes

**Scope:** XL
**Files:** `node.ts`, `tree.ts`, `operations.ts`, `bt-schema.ts`, `serialize.ts`, `deserialize.ts`, `rules.ts`, `bt-store.ts`, `kind-visuals.ts`, `kind-icons.tsx`, `PropertyPanel.tsx`, `bt-json-format.md`

### F14 — Multi-Tab Editing

Tab bar above canvas for navigating between tree definitions in a document.

**Acceptance criteria:**
- Tab bar shows one tab per tree definition in the document
- Click tab → canvas switches to that tree
- "+" button creates new empty tree definition (with Root node)
- "x" button / context menu deletes non-main trees (with confirmation)
- Renaming a tree updates all SubTree nodes referencing it
- Per-tab viewport position/zoom
- Undo/redo operates within active tab only
- Save/Open handles entire document (all trees)

**Scope:** L–XL
**Files:** `TabBar.tsx` (new), `App.tsx`, `bt-store.ts`, `Canvas.tsx`, `Toolbar.tsx`

**Order:** F13 → F14 (tabs require the document model from F13).
**Dependencies:** v1.1–v1.3 recommended complete. v1.2 auto-layout is useful for newly created subtrees.

---

## v1.5 "Multi-Select & Duplicate"

> Originally introduced as F18 with release slot deferred (2026-04-29). Promoted into v1.5 on 2026-05-08 — selection infrastructure shipped with v1.4 Phase 2 (Shift+Click, Box-select, Ctrl/Cmd+A, multi-selected visuals, atomic `deleteSelection`), so the remaining work is the duplicate action plus the keyboard wiring. Repo Hygiene & Docs (former v1.5) pushed to v1.6.

### F18 — Multi-Select & Duplicate

**Motivation:** Authors of large trees frequently reuse similar structures with small variations. SubTree refs (F13) cover the *edit-once-applies-everywhere* case; multi-duplicate covers the *fork-and-diverge* case. The two are complementary, not redundant.

**Resolved decisions (from v1.4 kickoff and v1.5 promotion):**
- **Selection (already shipped in v1.4):** Shift-click extends a selection set; `Ctrl/Cmd+A` selects every node and edge in the active tree; Shift+drag is a box-select; selected nodes get `border-2` + ring; `deleteSelection` is one undo step.
- **Duplicate trigger:** `Ctrl/Cmd+D` only (duplicate-in-place-with-offset). The originally-proposed `Ctrl+C → Ctrl+V` alias was dropped during v1.5 spec drafting — without cross-tab clipboard or system-clipboard integration it would be cargo-cult copy-paste. Ctrl+C still works for text copy inside the property-panel name input via browser default (no editor-level handler).
- **Connection handling:** Edges *among* the duplicated set are copied with new IDs. Edges crossing the boundary (selected child ↔ non-selected parent) are dropped. The duplicated subtree lands as orphaned-in-place — matches the v1.0 precedent ("deleting a non-Root node leaves children disconnected").
- **History:** Single undo step covering the whole duplicate operation (same `withHistory` pattern `deleteSelection` already uses).
- **Selection after duplicate:** New selection becomes the duplicated set so the user can immediately drag, delete, or re-duplicate. Original selection cleared.

**Open design questions for the v1.5 spec thread:**
- Offset direction + magnitude (recommend `(GRID_SIZE, GRID_SIZE)` = `(25, 25)` for grid alignment).
- Edge cases: empty selection, edges-only selection, Root-only selection — all should be no-ops (no history snapshot).
- SubTree handling: `treeRef` preserved on the duplicate. Falls out of cloning, but needs an explicit test.

**Estimated scope:** S–M (only the duplicate action; selection infrastructure is already shipped).

**Files:** `src/core/model/operations.ts` (new pure `duplicateSelection`), `src/store/bt-store.ts` (action wrapping it), `src/components/toolbar/Toolbar.tsx` (Ctrl/Cmd+D + Ctrl+C/V keyboard handlers), `docs/user-guide.md` (Keyboard reference), plus unit + e2e tests.

---

## v1.6 "Repo Hygiene & Documentation" — SHIPPED 2026-05-10

**Objective:** Improve the repository's public-facing quality. Zero application code changes. No dependencies on other releases — placed last per user preference so features come first.

> Renumbered 2026-05-08 (was v1.5). Shipped 2026-05-10 across `c1dd558` T1 (move `SPEC.md` → `docs/`), `4c853ce` T2+T3 (`docs/README.md` index + `.gitignore` audit), `5eccba7` T4 (capture seven README screenshots), `894a0c7` T5 (rewrite README in labelme style + add cover.png + theming.png), `da2a8dd` ship checkpoint. Post-ship polish landed in `669655e`, `8879bfc`, `bdf2c73`, `d6dcfa0` (tradchinese mirror + screencast GIFs + tasks/ move).

### F15 — README Expansion

Expand from 24-line quickstart to comprehensive project documentation.

**Acceptance criteria:**
- **Project introduction:** What it is, target audience, key differentiators
- **Feature list:** All shipped features through v1.4
- **Installation:** Prerequisites (Node 20+), all npm scripts, PWA installation note
- **UI guide:** Annotated screenshots in `docs/screenshots/` (tracked in git)
- **Architecture overview:** 1-paragraph tech stack + link to `docs/SPEC.md`
- **Contributing:** Run tests, code style, link to `docs/SPEC.md` boundaries
- **License:** Reference to LICENSE file

**Scope:** M (writing + screenshot capture)

### F16 — Repository Root Tidy (scoped down)

Clean up repo organization. Config files stay at root — their tools require them there.

**What we do:**
- Move `SPEC.md` → `docs/SPEC.md`, update all internal references
- Optionally move `tasks/` → `docs/tasks/`
- Add `docs/README.md` as docs index
- Verify `.gitignore` covers generated dirs
- Document in README why config files live at root

**What we cannot do** (tools break):
- Move `package.json`, `tsconfig.json`, `index.html`, `vite.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `eslint.config.js`, `.prettierrc`, `playwright.config.ts`

**Scope:** S

**Order:** F16 (tidy paths) first, then F15 (README references correct paths).

---

## F19 — Cross-Tree Mutation Undo (v1.7 → v1.7.1) — SHIPPED 2026-05-10

> v1.7 closed the data-layer gap on 2026-05-09; v1.7.1 redesigned the model on 2026-05-10 after smoke testing surfaced three structural defects in the dual-stack approach. v1.7.1 is the live model on `main`.

### v1.7 — Cross-Tree Undo (historical, superseded)

Added 2026-04-30 after T9/T10 surfaced the cross-tree-mutation gap. Spec in `tasks/v1.7-todo.md`. Approach: per-tree stacks (`undoStacks` / `redoStacks`) plus a separate doc-level `globalUndoStack` / `globalRedoStack`, merged by monotonic `historySeq`. Closed F19 at the store level (commits `4f9f772`, `fbc2544`, `517b796`, `6207f02`, `9571967`, `87eb45b`, plus the planning commit `31f81e4`) but smoke testing on 2026-05-10 surfaced:
- **UI defect** — undo restored the snapshot's `activeTreeId` (decision 7) and so teleported users to a tab they had since clicked away from.
- **Algorithm defect** — the merge picked max-seq between *the active tab's* local stack and the global stack, so switching tabs changed which action got reverted next.
- **Data-model defect** — local stacks could hold entries whose snapshots referenced an earlier-than-current tree state after a global pop, producing visually no-op undos and resurrected forward branches on subsequent redo.

### v1.7.1 — Unified History Timeline (live)

**Motivation:** the document is a single editable artifact across multiple tree views; history should be a single chronological timeline. Tabs are pure UI projection over that timeline.

**Approach:** replace v1.7's four stacks + `historySeq` with one `undoStack: RingBuffer<DocSnapshot>` and one `redoStack: RingBuffer<DocSnapshot>` where `DocSnapshot = { document: BTDocument; activeTreeId: string }`. Every action that mutates the document — per-tree edits AND cross-tree mutations — pushes through a single `withSnapshot` helper. Undo/redo pop the unified stack and restore both fields, but `activeTreeId` is restored from the snapshot **only if the current activeTreeId is no longer present in the restored doc** (the "stillExists" fallback rule). Otherwise the user stays where they are.

**Shipped commits (linear, on `main`):**
- `2f1cade` plan — `tasks/v1.7.1-todo.md` spec
- `5775a49` T1–T4 — store refactor (single stack + `withSnapshot` + new undo/redo) + Toolbar selector simplification + unit-test rewrite + existing e2e fix
- `c8ff721` T5 — e2e: 5-action scenario undo/redo across tab switches + 3-tab undo-doesn't-teleport test
- `<T6 commit>` T6 — this docs entry + v1.7-todo.md pivot note

**Key design decisions** (full list in `tasks/v1.7.1-todo.md`):
- **Decision 1 — Single unified stack:** kills the algorithm-layer defect; undo always pops the most recent action regardless of active tab.
- **Decision 3 — Active-tab fallback rule:** undo/redo never moves the displayed tab unless the displayed tab is the one that just disappeared. Replaces v1.7 decisions 3 (which said active doesn't switch) and 7 (which said it does — the two conflicted; v1.7's code followed 7).
- **Decision 5 — Single redo invalidation rule:** any push clears `redoStack` entirely.
- **Decision 8 — Per-tree state cleanup unchanged:** viewport for a deleted tree is preserved so undoing the delete restores both content and viewport. (History is now doc-level so it always covers the deleted tree.)

**Final tally:** 370/370 unit tests (was 371; -1 net from rewrite, plus 12 new cases for the unified model), 35/35 e2e (was 33; +2 net).

---

## v1.8 "SubTree Hardening & Canvas Polish" — SHIPPED 2026-06-05

> Full spec: `docs/SPEC-v1.8.md`. Task breakdown: `docs/tasks/v1.8-todo.md`. Refined inventory: `docs/ideas/v1.8-v1.10-batch.md`.
> Added 2026-05-11 after early-user feedback on the v1.7.1 ship; FB5 added 2026-06-03 from a second feedback pass.

**Objective:** Close out user-reported papercuts after v1.7.1. Three bug fixes plus four small UX wins. Zero data-model changes; zero new dependencies.

**Items:**
- **B1** — SubTree node name is non-editable in PropertyPanel (was: per-keystroke renamed the referenced tree, blanking it broke every referrer). Read-only display + tab is the single rename surface.
- **B2** — Per-keystroke undo on SubTree rename. Fixed automatically by B1 (verified: only the SubTree branch lacked gesture batching).
- **B3** — `npm run preview` SW staleness. `preview:dev` script with `--mode no-pwa` is the dev-iteration convenience; the **FB-NEW1 root cause** (logo broken offline) was fixed at ship smoke by precaching `icon.svg`/`icon-dark.svg` via VitePWA `includeAssets` — they were never in the SW precache manifest.
- **FB1** — Layout button uses `fitView({ padding: 0.2 })` instead of `setCenter`.
- **FB2** — Visible zoom-level chip in the bottom-left Controls cluster; click resets to 100%.
- **FB4** — "Open Subtree ↗" button in PropertyPanel (gated by reference existence).
- **FB5** — Long node names wrap to a second line instead of truncating eagerly.

**Shipped:** 7 task commits — `8096803` T1 (B1/B2/FB4), `0c6d2d5` T2 (FB1), `c2770ed`+`0798f1b` T3 (FB2), `e24e5ee` T4 (B3), `a4d09be` T7 (FB5), `0cdb05b` T5 (tests). Final tally: **383/383 unit** (was 375), **38/38 e2e** (was 35); typecheck + build green.

**Deviations of note:**
- **B3 (T4):** PWA plugin is toggled via VitePWA's `disable: mode === 'no-pwa'` flag, not omitted from the plugins array — omitting it dangles `main.tsx`'s `virtual:pwa-register` import and breaks the build.
- **B3 root-cause fix (ship smoke):** revisited the "PWA strategy out of scope" line after manual smoke 3 showed the logo broken offline. The SW precache never included `icon.svg`/`icon-dark.svg`; added `includeAssets` to fix it (verified offline). The real FB-NEW1 fix.
- **FB5 (T7) finding:** `NODE_HEIGHT` (75px) already accommodates two lines of `text-sm` + the kind badge, so a wrapped 2-line label does **not** grow the node (measured: node stays 75px, label box grows 20→40px). The wrap-not-truncate fix works; the secondary "grow by one grid row to 100px" path is inert in practice (`useApplyLayout` feeds 75px for every node). The `nodeHeights` layout plumbing is correct and unit-tested with synthetic heights, and would engage only if node content ever exceeds 75px. Spec/AC wording softened accordingly; a real grow-on-wrap behavior would require changing the node base height (deferred — out of v1.8 scope).

**Estimated scope:** S–M. Critical path: 5 parallelizable tasks (T1 PropertyPanel + T2 fitView + T3 zoom chip + T4 PWA opt-out + T7 wrap) → T5 tests → T6 docs.

---

## v1.9 "Image Export"

> Full spec: `docs/SPEC-v1.9.md`. Task breakdown: `docs/tasks/v1.9-todo.md`.
> Added 2026-05-11.

**Objective:** Export the active tree as a PNG. Two modes — transparent (no overlays, no bg) and themed (current canvas bg color). Standalone surface, no coupling with v1.8 or v1.10.

### FR1 — Image Export

**Acceptance criteria:**
- New "Export image" Toolbar button → modal with mode toggle + filename input.
- PNG @ 2× pixel ratio.
- Captures the entire tree (uses `getNodesBounds()`), not just the visible viewport.
- Both modes hide AxisOverlay, OriginCross, and the per-node selection ring.
- Transparent mode also hides the dotted Background.
- Single transient store flag drives the conditional rendering; cleared in `finally`.
- No history snapshot pushed.

**Library:** `html-to-image` (~14 KB gz, no peer deps).

**Estimated scope:** S. Sequential 5 tasks: dep+flag → conditional rendering → hook+modal+button → tests → docs.

**Dependencies:** v1.8 recommended complete (Toolbar layout finalized).

### Status — SHIPPED + signed off 2026-06-05 (awaiting push)

All 5 tasks + the ship-checkpoint fix landed; ship checkpoint complete and 🛑 human sign-off granted. Not yet pushed.
- `3bbe080` T1 — `html-to-image` dep + transient `exportInProgress` flag (UI-only, excluded from `withSnapshot`/`DocSnapshot`).
- `49dc572` T2 — Canvas hides AxisOverlay/OriginCross while exporting + drops `<Background>` in transparent mode; BTNode suppresses the selection ring; capture target exposed via module-scoped `captureTargetRef`.
- `32dd39a` T3 — `useExportImage` (flag → rAF → `getNodesBounds` → `toPng` on `.react-flow__viewport` @ 2×, themed bg from `--bt-canvas-bg`, alpha when transparent) + `ExportImageModal` (v1.4 dialog pattern) + Toolbar **Export** button **next to Save** (user-chosen slot, not the spec's "next to Validate"), disabled on empty tree.
- `aa9eb71` T4 — `export-bounds` unit + `export-image` e2e (themed + transparent download in real Chromium — proves `toPng` captures the SVG viewport without throwing).
- _(this commit)_ T5 — user-guide EN + zh-TW "Export image" sections + this entry.

**Tally:** 403 unit (was 383 at v1.8), 40 e2e (was 38). typecheck + lint + build green. Bundle +6.06 KB gz (144.07 total), within the ≤20 KB budget. **Lighthouse v1.9 = v1.8 baseline exactly** (StartScreen 100/100/100/83; Editor snapshot —/100/100/67), no regression.

**Ship-checkpoint smoke fix (`0ec6909`):** first smoke caught two bugs — (1) exports clipped ~one node off the right + bottom because `useExportImage` called the standalone `getNodesBounds()` with user-facing nodes (no `measured` dims → every node 0×0 → box collapsed to top-left corners); fixed by using `useReactFlow().getNodesBounds()` (resolves measured dims via nodeLookup). (2) default filename now `<docStem>-<treeName>.png` (was `<treeName>.png`). User re-verified all clipping cases.

**Decisions / deviations:**
- Capture target = `.react-flow` root via `<ReactFlow ref>`; the hook captures the inner `.react-flow__viewport` (the framable element) and reframes via a translate so themed mode shows a solid bg (no dotted Background — that prose in SPEC §32 was descriptive, not an AC; AC1.8 only requires the bg color match).
- `ensurePngExtension` is **case-sensitive** (`MyTree.PNG → MyTree.PNG.png`) per the spec's explicit output — the "matches v1.1 precedent" annotation was wrong (v1.1 is case-insensitive).
- Modal/test paths follow the repo's `tests/unit/components/` convention, not the spec's `tests/component/`.

**Remaining:** push to `origin/main` (still at v1.8 `518693c`).

---

## v1.10 "Cross-Tree Composition (Tab Reorder + Move/Copy)"

> Full spec: `docs/SPEC-v1.10.md`. Task breakdown: `docs/tasks/v1.10-todo.md`.
> Added 2026-05-11. Highest-risk release in the v1.8–v1.10 batch.

**Objective:** Two features that together let users compose larger workflows. Tab reorder lands first so Move/Copy's destination picker reflects user-meaningful tab order.

### FB3 — Tab Reordering (Phase A)

**Acceptance criteria:**
- Drag a tab horizontally to reorder; visual placeholder shows drop position.
- Drop changes order of `BTDocument.trees`; active tab unchanged.
- Esc / drop outside cancels.
- × close button and rename input stop event propagation (no drag triggered).
- Keyboard reorder (Space to lift, arrow to move, Space to drop).
- Touch reorder.
- One `withSnapshot` per drop.

**Library:** `@dnd-kit/core` + `@dnd-kit/sortable` (~25 KB gz). Picked for accessibility (keyboard, screen reader) and touch support.

### FR2 — Cross-Tree Move/Copy (Phase B)

**Acceptance criteria:**
- Toolbar "Move / Copy" button enabled iff ≥1 node selected AND ≥2 trees in document.
- Modal: destination dropdown (tabs in current order), Move\|Copy radio (default Move), summary of N nodes / M edges / K dropped boundary edges, validation messages, Confirm/Cancel.
- **Move:** preserves IDs; removes from source; adds to destination. Boundary edges silently dropped.
- **Copy:** regenerates IDs (extracts shared `regenerateIds` helper from v1.5 `duplicateSelection`); source unchanged; destination receives new-ID nodes + edges.
- Validation: V1 Root conflict, V2 cycle prevention.
- After Confirm: `activeTreeId` switches to destination; transferred/copied node IDs become new selection.
- One `withSnapshot` covers both source + destination mutations + active tab swap + selection swap. Single Ctrl+Z reverts everything.

**Architectural note:** First action since v1.7.1 that *intentionally* mutates two trees in one snapshot. Verified safe per `withSnapshot` semantics (captures full `BTDocument` + `activeTreeId` per push).

### Out of scope (v1.10)

- Drag-selection-onto-tab as Move trigger.
- Cross-document move/copy.
- Smart-merge of edges to unselected nodes.
- Move/Copy keyboard shortcut.

**Estimated scope:** M–L. 9 tasks split across two phases. Phase A critical path: 3 tasks. Phase B critical path: 5 tasks (T4 can start in parallel with Phase A).

**Dependencies:** v1.8 recommended complete; v1.9 can interleave or land before/after v1.10.

---

## Dropped Features

### F17 — Reusable Node Templates (DROPPED 2026-05-11)

Originally targeted v2.0. Dropped per user decision after v1.4's SubTree references (F13) shipped — the *edit-once-applies-everywhere* case is well-served by SubTree refs, and the *fork-and-diverge* case is well-served by v1.5 duplicate + (planned) v1.10 Copy. The novel template-registry abstraction no longer feels compelling for the cost.

**AD5 retired** — no longer a load-bearing roadmap decision.

---

## Deferred (Not Scheduled)

### FR4 — Interop with External BT Formats

User request 2026-05-11. Import/export to BehaviorTree.CPP XML, Groot, etc. Each format is a substantial spec on its own. No urgent user pull; revisit if demand grows.

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
