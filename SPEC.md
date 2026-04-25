# Spec: Behavior Tree Visualization Tool

> Status: **Approved — Phase 1 fully locked; Phase 2 open items A and B closed on 2026-04-22.**
> Last updated: 2026-04-22

## Objective

A lightweight, offline-first tool for **authoring, visualizing, and verifying behavior trees (BTs)** through a drag-and-drop canvas interface. Designed for robotics engineers and students learning BTs.

Inspired visually and interactionally by [Groot2](https://www.behaviortree.dev/groot) and [Canva](https://www.canva.com); inspired operationally by [Peko-Step](https://www.peko-step.com) — no account, no cloud, just open/edit/save files locally.

### Target users
- **Robotics engineers** — author and inspect BTs used on real robot stacks.
- **Students learning BTs** — explore structure, experiment, and visualize relationships without engine/runtime overhead.

### What success looks like
A first-time user can open the tool, design a non-trivial BT (≥10 nodes), validate its structure, save it to a JSON file, and reopen it later — all without installing a toolchain, signing in, or connecting to a server.

### Primary use cases
1. **Authoring** — build a new tree from scratch via drag-and-drop.
2. **On-demand debugging of structure** — load an existing tree and inspect/validate its topology. *(Runtime tick debugging is out of scope — see Non-goals.)*
3. **Modification** — open an existing JSON tree, edit, save back.

### Non-goals
- Real-time / live execution tick visualization (no runtime connection to a robot or simulator).
- Multi-project / project list / workspace management.
- Multi-user collaboration, cloud sync, account system, backend services.
- Import/export of external formats (e.g. BehaviorTree.CPP XML) in v1 — see Defaults Applied (Q7).
- **Draw.io-style smart alignment guides** between shapes (dashed lines that appear when a shape lines up with another shape's edge/center). Snap-to-grid alone is sufficient for v1; smart guides are deferred. *(Decided 2026-04-22 during S2 review.)*

## Tech Stack (approved)

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript** | Type safety is high-leverage for a structured-data tool (trees, validators, schemas). |
| Framework | **React 18** | Largest ecosystem for node-editor primitives; React Flow lives here. |
| Build tool | **Vite** | Fastest dev loop; outputs a static bundle deployable anywhere. |
| Canvas / graph | **React Flow (`@xyflow/react`)** | Purpose-built for drag-and-drop node editors. Provides pan, zoom, connections, snap-to-grid, custom nodes. Apache-2.0. |
| State | **Zustand** + small undo/redo ring buffer | Minimal boilerplate; works with React Flow's own patterns. |
| Styling | **Tailwind CSS** | Fast UI iteration; no runtime CSS-in-JS cost. |
| File I/O | Browser `File` API + `Blob` download | Matches the Peko-Step "upload/download" UX. No server. |
| Packaging | **PWA** (installable, offline-capable web app) | Zero binary, zero installer. User visits URL once; service worker caches the shell for offline use. Decision: defer native desktop (Tauri) to v2+ if a user requests it. |
| PWA runtime | `vite-plugin-pwa` (Workbox under the hood) | Generates service worker and manifest with minimal config. |
| Testing | Vitest + React Testing Library + Playwright | Unit, component, e2e respectively. |
| Lint / format | ESLint + Prettier | Standard. |

## Commands

```bash
npm install             # one-time setup
npm run dev             # start Vite dev server at http://localhost:5173
npm run build           # build static bundle to dist/ (PWA-ready; deployable to any static host)
npm run preview         # preview the production build locally (service worker active here)
npm test                # run Vitest in watch mode
npm run test:ci         # run Vitest once with coverage
npm run test:e2e        # run Playwright end-to-end tests
npm run lint            # ESLint --fix
npm run typecheck       # tsc --noEmit
```

## Project Structure (proposed)

```
behavior-tree-visualization-tool/
├── src/
│   ├── main.tsx                    # Vite entry
│   ├── App.tsx                     # Top-level layout: canvas + panels
│   ├── components/
│   │   ├── canvas/                 # React Flow wrapper, custom node types, edge types
│   │   ├── toolbar/                # Top toolbar (file open/save, undo/redo, validate)
│   │   ├── node-palette/           # Drag source for new nodes
│   │   └── property-panel/         # Right-hand inspector
│   ├── core/
│   │   ├── model/                  # BT data types (Tree, Node, NodeType, Connection)
│   │   ├── schema/                 # JSON schema + zod validators for the file format
│   │   ├── validation/             # BT structural rules (root-single-child, leaf types, etc.)
│   │   ├── serialization/          # Tree → JSON, JSON → Tree
│   │   └── history/                # Undo/redo ring buffer (max 5)
│   ├── store/                      # Zustand store(s)
│   ├── hooks/                      # Reusable React hooks
│   └── styles/                     # Tailwind entry + theme tokens
├── public/
│   ├── manifest.webmanifest        # PWA manifest (name, icons, theme)
│   └── icons/                      # PWA icon set (192, 512, maskable)
├── tests/
│   ├── unit/                       # Vitest — pure logic (model, validation, serialization)
│   └── component/                  # React Testing Library
├── e2e/                            # Playwright specs
├── docs/                           # Format spec, ADRs
│   ├── bt-json-format.md           # The custom JSON format specification
│   └── adr/                        # Architecture decision records
├── screenshots-for-presentation/   # (existing — presentation assets)
├── text-contents-for-presentation/ # (existing — presentation assets)
├── SPEC.md                         # This file — living source of truth
├── README.md
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
└── playwright.config.ts
```

## Code Style

- **Naming:** `PascalCase` for types and React components, `camelCase` for variables/functions, `SCREAMING_SNAKE_CASE` for top-level constants, kebab-case for filenames (except component files which match the component name).
- **File-per-thing bias:** one primary export per file, named after the file.
- **No default exports** except at Vite entry points — named exports only, so grep/IDE refactors work cleanly.
- **Prefer pure functions in `core/`** — everything under `src/core/` must be framework-free and unit-testable without React.
- **No comments describing *what*** — only *why* when non-obvious (invariants, tricky edge cases, links to BT literature).

Example:

```ts
// src/core/model/node.ts

// Fixed enum — users cannot define custom node kinds in v1.
export const NODE_KINDS = [
  'Root',
  'Sequence',
  'Fallback',
  'Parallel',
  'Decorator',
  'Action',
  'Condition',
  'Group',
] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

export interface BTNode {
  id: string;
  kind: NodeKind;
  name: string;
  position: { x: number; y: number };
  properties: Record<string, unknown>;
}

export interface BTConnection {
  id: string;
  parentId: string;
  childId: string;
  // Sibling ordering is semantically meaningful for Sequence / Fallback / Parallel.
  // `order` is a non-negative integer; smaller = earlier (left-to-right in the canvas).
  order: number;
}

export interface BehaviorTree {
  version: 1;
  nodes: BTNode[];
  connections: BTConnection[];
  rootId: string;
}
```

## Testing Strategy

| Level | Tool | Location | What it covers |
|---|---|---|---|
| Unit | Vitest | `tests/unit/` | Pure logic in `src/core/`: model operations, validators, serialization, history ring buffer. Target: ≥90% line coverage on `src/core/`. |
| Component | Vitest + React Testing Library | `tests/component/` | Individual React components in isolation: property panel rendering, node palette drag sources, toolbar buttons. |
| End-to-end | Playwright | `e2e/` | Full user flows: launch → create tree → validate → save → reload. Runs against `npm run preview`. |

**Rules:**
- Every bug fix lands with a regression test (the "Prove-It" pattern).
- No test for pure rendering/JSX with no logic — that's just snapshotting noise.
- Validation rules are table-driven: one test per rule, with a valid + invalid fixture.

## Boundaries

### Always do
- Keep `src/core/` free of React and DOM imports — it must be portable and unit-testable.
- Run `npm run typecheck && npm test && npm run lint` before every commit.
- Update `SPEC.md` and `docs/bt-json-format.md` when the data model changes.
- Add a regression test when fixing a bug.
- Keep the undo/redo buffer cap enforced (5 entries).

### Ask first
- Adding a new runtime dependency (npm package). Prefer writing ~50 lines over pulling in a transitive dependency graph.
- Changes to the JSON file format (breaking changes require a `version` bump + migration path).
- Adding a new BT node kind (affects validator, palette, property panel, docs).
- Changes to validation rules.
- Introducing a backend, network call, or telemetry of any kind.

### Never do
- Commit secrets, API keys, or `.env` files.
- Add an account system, login flow, or user identity concept.
- Make network calls from the core app (analytics, CDN fonts, remote configs — all no).
- Edit vendored files in `node_modules/` or `dist/`.
- Remove or skip failing tests without a documented reason and human approval.

## Success Criteria

A v1 is "done" when all of the following are true:

1. **Launch → immediate editing.** Opening the app (in a browser or as an installed PWA) shows a canvas with a single undeletable Root node. No splash, no login, no project chooser.
2. **Node lifecycle.** User can create nodes via a palette drag, move them, edit their name and kind via a property panel, and delete them. Deleting a non-root node leaves its children disconnected (subtree preserved as orphaned nodes).
3. **Connection lifecycle.** User can draw parent→child connections by dragging between ports, and delete connections.
4. **Canvas interactions.** Pan (drag background), zoom (wheel / pinch), snap-to-grid on both drop (new nodes from the palette) and drag (existing nodes). Grid size is configurable via a single constant (`src/core/config/grid.ts`, default 25 px). Node dimensions are integer multiples of the grid size (default 150 × 75 px = 6 × 3 grid cells), so every node edge lands on a grid line. A Draw.io-style line background reinforces the grid visually. React Flow's built-in controls overlay is shown in the lower-left: zoom in/out, fit view, and a "toggle interactivity" lock that puts the graph into read-only mode (disables node drag, connect, and selection) — useful for screenshots and demos. See Q9.
5. **Undo/redo.** Up to 10 steps, Ctrl+Z / Ctrl+Shift+Z bindings. Buffer older than 10 is dropped.
6. **Validation on demand.** A "Validate" button runs structural checks (see `docs/bt-json-format.md` §Rules). Errors and warnings are shown in a panel with clickable references that select the offending node.
7. **File I/O.** "Open" loads a `.json` file from disk; "Save" downloads the current tree as `.json`. Round-trip is lossless.
8. **PWA installable and offline-capable.** `npm run build` produces a deployable static bundle with a valid `manifest.webmanifest` and a service worker that caches the app shell. After first load, the app works with no network. Lighthouse PWA audit passes.
9. **Child order preserved round-trip.** Reorder children under a Sequence, save, reload — the order survives.
10. **Documentation exists.** `docs/bt-json-format.md` defines the JSON schema. `README.md` has a 5-line quickstart.

## Resolved Decisions

| # | Question | Decision |
|---|---|---|
| Q1 | Packaging | **PWA-only** for v1. No Tauri/Electron binary. Revisit in v2+ only if a user explicitly requests it. |
| Q2 | Node kinds | **Fixed enum** (not user-extensible in v1): `Root, Sequence, Fallback, Parallel, Decorator, Action, Condition, Group`. **All 8 kinds ship in v1** (confirmed 2026-04-22; Open Item A closed). Kind-specific properties remain deferred to v2 per Q4. `SubTree` (leaf reference to another tree) is reserved for post-v1; renamed to `Group` on 2026-04-23 because v1 uses the node for in-tree visual grouping rather than file references. |
| Q3 | Validation rules | **Approved** as proposed: single Root with exactly one child; Action/Condition are leaves; Sequence/Fallback/Parallel require ≥1 child; Decorator has exactly 1 child; no cycles; every non-root node has exactly one parent OR is explicitly orphaned; orphaned nodes produce warnings, not errors. |
| Q5 | Child ordering | **Preserved in JSON.** `BTConnection.order` is a non-negative integer; siblings under the same parent are rendered and executed left-to-right by ascending `order`. Round-trip must be lossless. |

## Accepted Defaults

*(Originally proposed by the agent as defaults; confirmed by the human on 2026-04-22.)*

| # | Question | Decision |
|---|---|---|
| Q4 | Property panel scope | **v1 = name + kind only.** Kind-specific properties (Decorator inner-kind, Parallel success threshold, etc.) deferred to v2. Leaves a clean surface for v1. |
| Q6 | Keyboard shortcuts | **v1 set:** Ctrl/Cmd+Z (undo), Ctrl/Cmd+Shift+Z (redo), Delete/Backspace (delete selected), Ctrl/Cmd+S (save), Ctrl/Cmd+O (open), Ctrl/Cmd+A (select all). |
| Q7 | External format import | **Out of scope for v1.** Only this tool's custom JSON is supported. |
| Q8 | Presentation folders | **Untracked.** `screenshots-for-presentation/` and `text-contents-for-presentation/` stay out of the repo — they are local scratch/reference assets. `.gitignore` excludes them. *(Revised 2026-04-22: earlier wording said "remain tracked" but they were never added to the repo. Intent clarified to match reality.)* |
| Q9 | Canvas controls overlay | **Keep React Flow's default `<Controls />` overlay in the lower-left.** Includes zoom in/out, fit view, and "toggle interactivity" (read-only lock). Decided during S1 review (2026-04-22). The lock toggle is kept because it is a useful demo/screenshot affordance at zero cost — it flips the `nodesDraggable`, `nodesConnectable`, and `elementsSelectable` flags together. |

## Open Items

*(Phase 2 open items resolved on 2026-04-22. No items currently open.)*

- ~~**Open Item A — Node kind coverage in v1.**~~ **Closed 2026-04-22.** All 8 kinds ship in v1. See Q2 above.
- ~~**Open Item B — JSON format spec.**~~ **Closed 2026-04-22.** See [`docs/bt-json-format.md`](docs/bt-json-format.md).

---

## v1.1 — Polish & Ergonomics

> Status: **Approved — all decisions locked on 2026-04-25.**
> Last updated: 2026-04-25

### Objective

Seven UI-focused improvements that make the app feel professional and address early user feedback. Zero data model changes. One new asset class (self-hosted font files), zero new npm dependencies.

### Features

#### F1 — App Branding

Add the tree icon (`public/icon.svg`) and project name **"BT Visualizer"** to the left side of the toolbar, visually separated from the action buttons.

**Acceptance criteria:**
- The SVG tree icon renders at 24×24 px on the left edge of the toolbar.
- The text "BT Visualizer" appears immediately to the right of the icon, in `text-sm font-semibold text-slate-900`.
- A vertical separator (`|`) divides the branding area from the first action button group.
- The icon references the existing `public/icon.svg` file (inline SVG or `<img>` tag).

**Layout:**
```
┌──────────────────────────────────────────────────────────────────────┐
│ 🌳 BT Visualizer │ Open Save │ Undo Redo │ Validate ··· Untitled.json│
└──────────────────────────────────────────────────────────────────────┘
```

#### F2 — Bigger Handles

Enlarge React Flow connection handles from the default 6×6 px to **12×12 px** with a visible border ring, so they are easier to see and drag.

**Acceptance criteria:**
- Handle size is 12×12 px (width and height).
- Handles have a solid white fill with a 2 px `slate-400` border, matching the node's visual language.
- On hover, the border color darkens to `slate-600` and cursor changes to `crosshair`.
- Handles remain centered on the top (target) and bottom (source) edges of the node.
- Styling is applied via CSS in `src/styles/tailwind.css` targeting `.react-flow__handle`, not inline styles on each `<Handle>` component.

#### F3 — File Name Display

Show the current file name in the toolbar. Default is `"Untitled.json"` for new/unsaved trees.

**Acceptance criteria:**
- A `fileName` field is added to the Zustand store (`bt-store.ts`), initialized to `'Untitled.json'`.
- When a file is opened via the Open button, `fileName` updates to the opened file's name (from `file.name`).
- When `setTree()` is called (new tree loaded), `fileName` resets to `'Untitled.json'`.
- The file name appears **right-aligned** in the toolbar, pushed by a flex spacer (`flex-1`).
- The file name displays as `text-sm text-slate-600`, with `cursor-pointer` to hint at editability.
- When saving, the download uses the current `fileName` value (instead of the hardcoded `'behavior-tree.json'`).

#### F4 — File Rename

Allow users to rename the file by clicking the file name text in the toolbar.

**Acceptance criteria:**
- Single-clicking the file name text switches to an inline `<input>` element, pre-filled with the current name.
- The input auto-selects the name portion **excluding** the `.json` extension (e.g., in `"Untitled.json"`, only `"Untitled"` is selected).
- Pressing **Enter** or **blurring** the input confirms the rename and stores the new value.
- Pressing **Escape** cancels the rename and reverts to the previous name.
- Empty names are rejected — revert to previous name on blur/Enter if empty.
- The `.json` extension is enforced: if the user removes it, it is appended automatically on confirm.
- File rename does **not** create an undo/redo entry (it is UI metadata, not tree data).

#### F5 — Short IDs in Property Panel

Display human-readable short IDs (first 8 characters of UUID) for nodes, edges, parents, and children in the Property Panel.

**Acceptance criteria:**
- A utility function `shortId(id: string): string` is added (returns `id.slice(0, 8)`). Location: `src/core/model/node.ts` (co-located with the types that define IDs).
- **Single node selected:** Panel shows:
  - Node ID (already present — keep as-is): `ID: abcd1234…`
  - Parent ID: `Parent: ef567890…` (or `Parent: none` if root/orphan)
  - Children IDs: `Children: 12ab34cd, 56ef78gh` (comma-separated) or `Children: none` for leaf nodes
- **Single edge selected:** Panel shows:
  - Edge ID: `ID: aabb1122…`
  - Source (parent) node: `From: ccdd3344… (NodeName)`
  - Target (child) node: `To: eeff5566… (NodeName)`
- The current multi-selection summary (e.g., "3 nodes, 2 edges selected") remains unchanged.
- All IDs are wrapped in `font-mono` so characters align.

#### F6 — Start Screen

Show a full-page start screen on every fresh page load (Photopea-style in-app welcome). This replaces the v1 behavior of dropping directly into the editor, giving users a branded entry point.

> **Note:** This intentionally overrides v1 Success Criterion 1 ("No splash, no login, no project chooser"). User feedback indicated the immediate-editor experience felt "too informal."

**Layout:**
```
┌─────────────────────────────────────────┐
│                                         │
│            🌳 (icon, 64×64 px)          │
│             BT Visualizer               │
│    Author, visualize, and validate      │
│            behavior trees               │
│                                         │
│      [ New Tree ]    [ Open File ]      │
│                                         │
│          (error message area)           │
│                                         │
└─────────────────────────────────────────┘
```

**Acceptance criteria:**
- Full-page centered layout renders the app icon (`public/icon.svg`) at 64×64 px, the brand name "BT Visualizer", and a tagline.
- **"New Tree"** button (primary style) hides the start screen and shows the editor with the default empty tree (initial store state).
- **"Open File"** button (secondary/outlined style) opens a file picker; on success, loads the tree into the store and hides the start screen.
- File open errors display inline below the buttons (same error handling as Toolbar).
- The start screen is shown on every fresh page load — no localStorage persistence of dismissal state.
- Keyboard shortcuts (Ctrl+O, Ctrl+S, etc.) are only active in the editor view, not on the start screen.
- Start screen state is local React state in `App.tsx` (`useState(true)`), not in Zustand. Undo/redo must not affect it.
- File-open logic is extracted into a shared `useFileOpen` hook (`src/hooks/useFileOpen.ts`) used by both StartScreen and Toolbar.

#### F7 — Design Language Polish (Welcome UI Level A)

Borrow the Welcome UI design language at Level A (aesthetic tokens only — no library dependency). This gives the app consistent typography, border radius, and shadow treatment.

**Design tokens:**
- **Font:** Work Sans (self-hosted in `public/fonts/`, weights 400/500/600). No CDN calls — per SPEC §Boundaries ("Never do: Make network calls from the core app").
- **Border radius:** `rounded-lg` (8px) consistently across all interactive elements (replacing current `rounded-md` / 6px).
- **Shadows:** Two custom tokens: `shadow-subtle` = `0 1px 2px rgba(0,0,0,0.04)` and `shadow-card` = `0 4px 6px rgba(0,0,0,0.08)`.
- **Base font:** Applied via `@layer base { body { @apply font-sans; } }` in `tailwind.css`.

**Acceptance criteria:**
- Work Sans renders across the entire app (verifiable via DevTools computed `font-family`).
- `tailwind.config.ts` extends `fontFamily.sans` with Work Sans, adds `boxShadow.subtle` and `boxShadow.card`.
- `src/styles/tailwind.css` contains `@font-face` declarations for Work Sans at weights 400, 500, 600.
- All interactive elements (buttons, inputs, selects, alert boxes, node cards, palette items) use `rounded-lg` (8px).
- Shadow values are subtle and consistent across node cards and palette items.
- No logic changes, no new React components from this feature alone.
- Existing tests pass without modification (tests use semantic queries, not CSS class selectors).

### Files Modified

| File | Change |
|------|--------|
| `src/components/toolbar/Toolbar.tsx` | Add branding (icon + name), flex spacer, file name display, click-to-rename input; refactor file-open logic to use `useFileOpen` hook |
| `src/components/canvas/BTNode.tsx` | Update `rounded-md` → `rounded-lg`, shadow tokens (F7) |
| `src/components/property-panel/PropertyPanel.tsx` | Add parent/children IDs for nodes, edge detail view for edges; update `rounded-md` → `rounded-lg` (F7) |
| `src/components/node-palette/NodePalette.tsx` | Update `rounded-md` → `rounded-lg`, shadow tokens (F7) |
| `src/components/validation/ValidationPanel.tsx` | Update `rounded-md` → `rounded-lg` (F7) |
| `src/store/bt-store.ts` | Add `fileName` field + `setFileName` action; update `setTree` to accept optional file name |
| `src/styles/tailwind.css` | Add `.react-flow__handle` CSS overrides; add `@font-face` declarations for Work Sans; add base `font-sans` layer |
| `src/core/model/node.ts` | Add `shortId()` utility function |
| `tailwind.config.ts` | Extend theme: `fontFamily.sans` (Work Sans), `boxShadow.subtle`, `boxShadow.card` |
| `src/App.tsx` | Add conditional render: start screen vs editor (local `useState`) |
| `src/hooks/useFileOpen.ts` | New: shared file-open logic hook (extracted from Toolbar) |
| `src/components/start-screen/StartScreen.tsx` | New: full-page start screen component |
| `public/fonts/` | New: self-hosted Work Sans WOFF2 files (weights 400, 500, 600) |

### Files NOT Modified

- `src/core/model/operations.ts` — no data model changes
- `src/core/schema/bt-schema.ts` — no schema changes
- `src/core/serialization/serialize.ts` — file name is UI metadata, not serialized into the tree JSON
- `src/core/serialization/deserialize.ts` — deserialization is called from `useFileOpen`, but the module itself is unchanged
- `docs/bt-json-format.md` — JSON format is unchanged

### Boundaries

**Always do:**
- Keep `fileName` out of the undo/redo system — it is UI metadata, not tree content.
- Keep `shortId()` in `src/core/` so it is unit-testable without React.
- Ensure handle CSS does not break existing node selection visual feedback.
- Self-host fonts in `public/fonts/` — no CDN calls. The app must work offline.
- Keep start screen state as local React state in `App.tsx`, not in Zustand.

**Ask first:**
- If the tree icon SVG needs modification or a separate smaller version.
- If the branding text should link anywhere (homepage, docs).
- If button padding should be adjusted beyond the `rounded-md` → `rounded-lg` change.

**Never do:**
- Store the file name inside the `BehaviorTree` JSON — it is not part of the data model.
- Change the JSON format or schema version for v1.1.
- Add tooltips, popovers, or other UI patterns not specified above.
- Load fonts or any other assets from a CDN or external URL.
- Import the Welcome UI npm package — we borrow the aesthetic only (Level A).

### Testing Strategy

| Level | What to test |
|-------|-------------|
| Unit (Vitest) | `shortId()` returns first 8 chars; handles edge cases (empty string, short string) |
| Component (Vitest + RTL) | Toolbar renders branding text; file name displays; rename flow (click → type → Enter confirms, Escape cancels); PropertyPanel shows parent/children IDs; StartScreen renders brand + two CTAs; "New Tree" calls callback; "Open File" triggers file input and handles success/error |
| E2E (Playwright) | Open a file → verify file name updates in toolbar; rename file → save → verify downloaded file has new name; fresh load → start screen visible → "New Tree" → editor with Root; "Open File" with fixture → editor with loaded tree. **Note:** existing `authoring.spec.ts` tests must be updated — `beforeEach` needs to dismiss the start screen before interacting with the editor |

### Success Criteria (v1.1)

1. **Branding visible.** The tree icon and "BT Visualizer" text appear in the toolbar on every page load.
2. **Handles are grabable.** A user can reliably click and drag handles without precision frustration. Visual hover feedback confirms the handle is interactive.
3. **File name tracks reality.** Opening a file shows its name; new trees show "Untitled.json"; saving uses the current name.
4. **Rename works cleanly.** Click → edit → Enter confirms. Escape cancels. Empty names rejected. `.json` enforced.
5. **IDs are readable.** Property panel shows short IDs for the selected node's relationships (parent, children) and for selected edges (source, target).
6. **Start screen greets users.** Fresh page load shows the start screen with brand identity. "New Tree" and "Open File" both lead to the editor. No persisted skip.
7. **Consistent design language.** Work Sans font renders everywhere. All interactive elements use 8px border radius. Shadow values are subtle and consistent.
8. **No regressions.** All unit tests, component tests, and e2e tests pass (with e2e tests updated to dismiss start screen). Lighthouse score does not regress.
