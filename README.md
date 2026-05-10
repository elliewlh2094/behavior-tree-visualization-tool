<h1 align="center">BT Visualizer</h1>

<p align="center">
  <em>An offline-first PWA for authoring, visualizing, and validating behavior trees.</em>
</p>

<p align="center">
  <img src="docs/screenshots/cover.png" alt="BT Visualizer start screen" width="800" />
</p>

A browser-based editor for behavior trees — the decision-making structure used in robotics and game AI. Drag nodes from a palette, connect them by their handles, validate the result against structural rules, and save or load standards-aligned JSON. Everything runs in the browser; there is no server, no account, and the tool stays available offline after the first load.

Built for robotics and game-AI developers who want a focused authoring tool without spinning up a heavyweight environment, and for researchers and students who prefer to learn behavior-tree concepts by building them visually.

## Features

### Authoring

Drag nodes from the palette onto the canvas, snap them to the grid, connect them by their handles, and let auto-layout tidy the result.

<!--
  Placeholder image. Replace with a screen-recorded GIF that shows:
  drag-and-drop from palette → snap-to-grid placement → connect handles →
  auto-layout. Save as docs/screenshots/authoring.gif and update the src below.
-->
<p align="center">
  <img src="docs/screenshots/editor-overview.png" alt="Authoring a behavior tree" width="800" />
</p>

- Nine node kinds: `Root`, `Sequence`, `Fallback`, `Action`, `Condition`, `Decorator`, `Inverter`, `Wait`, `SubTree`.
- Drag-and-drop from the palette; snap-to-grid.
- Multi-select via Shift+Click, box-select, or `Ctrl/Cmd+A`.
- Duplicate selection (`Ctrl/Cmd+D`) — connections within the duplicated subgraph are preserved.
- Child ordering derived from horizontal canvas position (no manual reorder UI needed).
- Auto-layout that anchors at the Root and places orphans above.

### Multi-tab composition

A document holds many named trees, accessed via tabs. A `SubTree` node references another tree by name and displays its label; renaming a tree propagates to every reference automatically. The on-disk format (v2) supports this natively, with v1 single-tree files auto-migrating on open.

<p align="center">
  <img src="docs/screenshots/multi-tree.png" alt="Multi-tab composition with SubTree node" width="800" />
</p>

### Validation

Click **Validate** to run structural rules: child-count constraints per node kind, broken `SubTree` references, orphan detection, duplicate IDs, and more. Each issue links to the offending node — including across tabs.

<p align="center">
  <img src="docs/screenshots/validation-panel.png" alt="Validation panel with an orphan node flagged" width="800" />
</p>

### Theming

Light and dark themes (FOUC-safe boot), and per-node-family color customization via the **Settings** tab in the right sidebar. Preferences persist across reloads.

<p align="center">
  <img src="docs/screenshots/theming.png" alt="Editor in dark mode with the Settings panel open" width="800" />
</p>

### Persistence and PWA

- Save / Open / file rename, all in-browser.
- Installable as a desktop or mobile app from supported browsers.
- Runs offline after first load.
- No server, no account, no telemetry.

## Quickstart

Prerequisites: **Node.js 20+**.

```bash
git clone <this-repo>
cd behavior-tree-visualization-tool
npm install
npm run dev        # opens http://localhost:5173
```

To install as a PWA from a Chromium-based browser, click the install icon in the address bar (or use the browser's install menu).

## npm scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server with HMR. |
| `npm run build` | Type-check and produce a static `dist/`. |
| `npm run preview` | Preview the production build locally. |
| `npm test` | Vitest in watch mode. |
| `npm run test:ci` | Single-shot unit tests with coverage. |
| `npm run test:e2e` | Playwright e2e tests. |
| `npm run typecheck` | TypeScript only, no emit. |
| `npm run lint` | ESLint with `--fix`. |
| `npm run format` | Prettier on the whole tree. |
| `npm run icons` | Regenerate PWA icon set from sources. |

## File format

The on-disk JSON format is documented in [`docs/bt-json-format.md`](docs/bt-json-format.md).
