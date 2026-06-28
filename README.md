<h1 align="center">BT Visualizer</h1>

<p align="center">
  <a href="README.md">English</a> | <a href="README.zh-TW.md">中文</a>
</p>

<p align="center">
  <em>No install, no signup — a web app for authoring, visualizing, and validating behavior-tree structures.</em>
</p>

<p align="center">
  <img src="docs/screenshots/cover.png" alt="BT Visualizer start screen" width="800" />
</p>

<h2 align="center">
  <strong>▶ <a href="https://elliewlh2094.github.io/behavior-tree-visualization-tool/">Go to  BT Visualizer</a></strong><br/>
</h2>

A browser-based behavior-tree visual editor.

Behavior trees are a decision-making structure commonly used in robotics systems and game AI. In this editor, you can drag nodes from a palette, connect them by their handles, validate structural correctness against behavior-tree rules, save or load standards-aligned JSON, and export the tree as an image.

Everything runs in the browser — no install, no signup. **Just open the link above**, or [fork the repo and run it locally](#run-locally) to develop or contribute.

Built for robotics and game-AI developers who want a focused authoring tool without spinning up a heavyweight environment, and for researchers and students who prefer to learn behavior-tree concepts by building them visually.

## Highlights

### Drag-and-drop behavior-tree node editing

Drag nodes from the palette onto the canvas, snap them to the grid, connect them by their handles, and let auto-layout tidy the result.

<p align="center">
  <img src="docs/screenshots/authoring.gif" alt="Authoring a behavior tree: drag from palette, connect handles, auto-layout" width="800" />
</p>

- Six behavior-tree node types: Root, Sequence, Fallback, Action, Condition, and Decorator.
- Plus Group and SubTree pseudo nodes to help structure your design.
- Multi-select with `Shift+Click` box-select, or `Ctrl/Cmd+A`.
- Duplicate selected objects (`Ctrl/Cmd+D`), preserving connections within the duplicated subgraph.
- Child ordering is derived from horizontal canvas position, so node order does not need to be defined manually.

### Multi-subtree editing

A single file can contain multiple tree structures, accessed through in-app tabs. A SubTree node references another tree by name and displays its label.

<p align="center">
  <img src="docs/screenshots/multi-tree.gif" alt="Multi-subtree editing: switch between trees and reference one from another via a SubTree node" width="800" />
</p>

### Structural validation

Click **Validate** to run structural validation: child-count constraints for each node type, broken SubTree references, orphan nodes, duplicate IDs, and more. Each issue in the validation panel can be clicked to reveal the offending node, including nodes across tabs. See the [user guide](user-guide.md) for the full rule list.

<p align="center">
  <img src="docs/screenshots/validation-panel.gif" alt="Running structural validation: issues appear in a panel and clicking a row reveals the offending node" width="800" />
</p>

### Light & dark themes, custom node colors

Light and dark themes, with per-node color customization via the **Settings** panel in the right sidebar. Preferences persist across reloads.

<p align="center">
  <img src="docs/screenshots/theming.gif" alt="Switching between light and dark themes and customizing per-node colors via the Settings panel" width="800" />
</p>

### Image export

Export the active tree as a PNG — choose a **themed** background (matching the current light or dark canvas) or a **transparent** one for slides. See the [user guide](user-guide.md) for the dialog options.

<!-- TODO: capture docs/screenshots/export.gif and embed here -->

### Start from a template

A ready-made template lets you explore a real multi-tree structure before authoring your own.

## Run locally

You only need this to develop or contribute — to *use* the tool, just [open it in your browser](https://elliewlh2094.github.io/behavior-tree-visualization-tool/).

Prerequisites: **Node.js 20+**.

```bash
git clone https://github.com/elliewlh2094/behavior-tree-visualization-tool.git
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
| `npm run preview` | Preview the production build locally (with PWA service worker). |
| `npm run preview:dev` | Preview a production build **without** the PWA service worker — avoids stale-cache surprises. |
| `npm test` | Vitest in watch mode. |
| `npm run test:ci` | Single-shot unit tests with coverage. |
| `npm run test:e2e` | Playwright e2e tests. |
| `npm run typecheck` | TypeScript only, no emit. |
| `npm run lint` | ESLint with `--fix`. |
| `npm run format` | Prettier on the whole tree. |
| `npm run icons` | Regenerate PWA icon set from sources. |

## Troubleshooting

**The app shows stale content at `localhost:4173` after rebuilding.**
`npm run preview` registers a PWA service worker that caches the build's hashed asset paths. After you stop the server and rebuild, a stale service worker can keep serving the previous build's paths until it updates on the next load, so freshly-hashed assets may briefly 404. Fix it either way:

- Run **`npm run preview:dev`** instead — it builds with `--mode no-pwa`, so no service worker is registered and nothing is cached.
- Or unregister the worker: DevTools → **Application → Service Workers → Unregister**, then hard-refresh. An incognito window also bypasses the cache.

Use `npm run preview` only when you specifically want to test PWA install/offline behavior.

## User Guide

More detail about keyboard shortcuts, tool walkthrough, multi-tree workflow. See: [`user-guide.md`](user-guide.md).
