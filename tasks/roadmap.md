# Roadmap: Behavior Tree Visualization Tool — v1.1 through v2.0

> Master plan for all post-v1.0 releases. Derived from 17 user ideas collected after v1.0 launch.
> Status: **Approved — 2026-04-26.**
> Last updated: 2026-04-26

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
| **v1.5** | Repo Hygiene & Docs | F15–F16 (2 features) | S–M | None |
| **v2.0** | Reusable Templates | F17 (1 feature, deferred) | L–XL | High |

## Dependency Map

```
v1.1 "Polish & Ergonomics" (in progress)
 │
 ├──► v1.2 "Canvas Control"
 │     │
 │     └──► v1.3 "Theming & Preferences"
 │           │
 │           └──► v1.4 "Subtrees & Composition"
 │
 └──► v1.5 "Repo Hygiene & Docs" (no code deps — can run anytime, placed last)
```

Critical path: v1.1 → v1.2 → v1.3 → v1.4.
v1.5 is fully independent and can be done in parallel with any release.

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
| 1 | README expansion | v1.5 | F15 |
| 2 | Repo root tidy | v1.5 | F16 |
| 15 | Reusable node templates | v2.0 | F17 |

---

## v1.1 "Polish & Ergonomics" — IN PROGRESS

> Full spec: `SPEC.md` §v1.1. Task breakdown: `tasks/v1.1-todo.md`.

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

## v1.5 "Repo Hygiene & Documentation"

**Objective:** Improve the repository's public-facing quality. Zero application code changes. No dependencies on other releases — placed last per user preference so features come first.

### F15 — README Expansion

Expand from 24-line quickstart to comprehensive project documentation.

**Acceptance criteria:**
- **Project introduction:** What it is, target audience, key differentiators
- **Feature list:** All shipped features through v1.4
- **Installation:** Prerequisites (Node 20+), all npm scripts, PWA installation note
- **UI guide:** Annotated screenshots in `docs/screenshots/` (tracked in git)
- **Architecture overview:** 1-paragraph tech stack + link to SPEC.md
- **Contributing:** Run tests, code style, link to SPEC.md boundaries
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

## v2.0 "Reusable Node Templates" (Future)

> Deferred from v1.4. Needs full spec after users have subtree experience.

### F17 — Reusable Nodes

Node templates where editing one instance updates all placements.

**Requires:** Template registry, `instanceOf` field on nodes, template editing UI, change propagation. Goes beyond Groot2/BehaviorTree.CPP — novel feature requiring careful design.

**Scope:** L–XL. Full spec needed before implementation.

---

## Key Architectural Decisions

| ID | Decision | Release | Rationale |
|----|----------|---------|-----------|
| AD1 | Preferences in separate Zustand store with `persist` middleware | v1.3 | Different lifecycle from tree data — persisted, no undo/redo, survives tree changes |
| AD2 | CSS custom properties for all theme-able colors | v1.3 | Runtime-changeable without re-renders; supports dark mode toggle |
| AD3 | Custom recursive tree layout, no dagre/elkjs | v1.2 | BT is strict hierarchy; ~100 lines vs 8–130KB dependency |
| AD4 | `BehaviorTree` → `BTDocument` model, file format v2 | v1.4 | Enables subtree references and multi-tree documents |
| AD5 | Reusable node templates deferred to v2.0 | v1.4/v2.0 | Subtree references cover most reuse needs; templates are a separate abstraction |
