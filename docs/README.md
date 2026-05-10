# BT Visualizer Documentation

Index for everything under `docs/`. The repository's top-level `README.md` is the project overview; this file is the in-tree map of formal docs, decisions, and audit artifacts.

## Specifications

- [`SPEC.md`](./SPEC.md) — living source of truth for scope, tech stack, boundaries, and per-release feature lists (v1.0 through current).
- [`bt-json-format.md`](./bt-json-format.md) — normative on-disk file format (v2; v1 accepted via auto-migration).
- [`v1.3-color-reference.md`](./v1.3-color-reference.md) — Tailwind hue families and shade ramps used by the theming system.

## Architecture decision records (ADRs)

- [`adr/001-zustand-for-state.md`](./adr/001-zustand-for-state.md) — Zustand for global state.
- [`adr/002-react-flow-for-canvas.md`](./adr/002-react-flow-for-canvas.md) — React Flow for the graph canvas.
- [`adr/003-pwa-only.md`](./adr/003-pwa-only.md) — PWA-only distribution (no native wrapper).
- [`adr/004-child-order-by-position.md`](./adr/004-child-order-by-position.md) — Child ordering derived from horizontal canvas position.
- [`adr/005-document-model-and-file-format-v2.md`](./adr/005-document-model-and-file-format-v2.md) — Multi-tree document model and file format v2.

## Audit and review

- [`lighthouse/`](./lighthouse/) — per-release Lighthouse audits (Performance / Accessibility / Best Practices / SEO) for both the start screen and editor, light + dark. See [`lighthouse/README.md`](./lighthouse/README.md) for the audit playbook.
- [`security/`](./security/) — security review notes (e.g., `npm audit` snapshots).

## Working artifacts (outside `docs/`)

These live at the repo root rather than under `docs/`:

- `tasks/` — per-release task breakdowns (`vX.Y-todo.md`) and the master `roadmap.md`. Working artifacts, not reference docs.
- `screenshots/` (when present) — README screenshot assets, captured per release.

## Why config files live at the repo root

Build tools (Vite, Tailwind, TypeScript, ESLint, Prettier, Playwright, PostCSS, the PWA plugin) all expect their config files at the project root and use the working directory to resolve relative paths inside those configs. Moving them under `docs/` or `config/` would require per-tool overrides and would break editor integrations. They stay at root by convention.
