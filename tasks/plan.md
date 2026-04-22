# Plan: Behavior Tree Visualization Tool — v1

> Phase 2 (planning) output. Source of truth for scope: `SPEC.md`.
> Status: **Approved — D1, D2, D3 confirmed by human on 2026-04-22. Ready to start S0.**
> Last updated: 2026-04-22

## How to read this document

- **`plan.md` (this file)** — rationale, dependency graph, slice boundaries, checkpoints, risks, decisions to confirm. Narrative.
- **`todo.md`** — flat, checkable task list derived from this plan. Tactical.

If the two disagree, this file wins and `todo.md` should be regenerated.

## Planning principles applied

1. **Vertical slices over horizontal layers.** Every task produces something a human can *see* — a working canvas, a round-trip save, a validation panel. No slice ends with "core library is done but nothing renders."
2. **Walking skeleton first.** Slice 1 wires the full stack (Vite → React → Zustand → React Flow → Tailwind → Vitest) end-to-end with minimum possible content. All later slices expand capability, not architecture.
3. **Acceptance criteria are executable.** Each task lists what a human or CI can verify without asking the author.
4. **Checkpoints between phases.** Four checkpoints (§Checkpoints below); do not proceed past a checkpoint without explicit human sign-off.
5. **Scope discipline.** Anything outside Success Criteria in SPEC.md is out of scope for v1, even if "easy."

## Dependency graph

```
                   ┌────────────────────────┐
                   │  S0: Pre-impl docs     │  ◄── JSON format spec (Open Item B)
                   │  S0.5: Scaffold        │  ◄── Vite + TS + React + Tailwind + Vitest
                   └───────────┬────────────┘
                               │
                   ┌───────────▼────────────┐
                   │  S1: Walking skeleton  │  ◄── CHECKPOINT 1
                   │  (Root node visible)   │
                   └───────────┬────────────┘
                               │
      ┌────────────────────────┼────────────────────────┐
      │                        │                        │
┌─────▼──────┐          ┌──────▼──────┐          ┌──────▼──────┐
│ S2: Create │          │ S3: Connect │          │ S4: Edit    │
│ + move     │          │ + delete    │          │ (props)     │
└─────┬──────┘          └──────┬──────┘          └──────┬──────┘
      └────────────────────────┼────────────────────────┘
                               │
                   ┌───────────▼────────────┐
                   │  S5: Save / Open        │  ◄── CHECKPOINT 2
                   │  (round-trip JSON)      │     demoable MVP
                   └───────────┬─────────────┘
                               │
      ┌────────────────────────┼────────────────────────┐
      │                        │                        │
┌─────▼──────┐          ┌──────▼──────┐          ┌──────▼──────┐
│ S6: Undo/  │          │ S7: Validate │          │ S8: Child   │
│ redo       │          │ panel        │          │ order       │
└─────┬──────┘          └──────┬──────┘          └──────┬──────┘
      └────────────────────────┼────────────────────────┘
                               │
                   ┌───────────▼────────────┐
                   │  S9: Canvas polish +   │  ◄── CHECKPOINT 3
                   │  remaining node kinds  │     all logic complete
                   └───────────┬────────────┘
                               │
                   ┌───────────▼────────────┐
                   │  S10: PWA shell        │
                   └───────────┬────────────┘
                               │
                   ┌───────────▼────────────┐
                   │  S11: Docs + E2E +     │  ◄── CHECKPOINT 4
                   │  Lighthouse            │     ship-ready
                   └────────────────────────┘
```

S2, S3, S4 are parallelizable *in principle* once S1 is done, but I've sequenced them for a single-developer flow. S6/S7/S8 are likewise parallelizable after S5.

## Decisions (confirmed by human on 2026-04-22)

### D1 — Resolve Open Item A (node kind coverage in v1) ✅ **CONFIRMED: all 8 kinds**

**Recommendation (accepted):** ship all 8 kinds, but with tiered property surfaces. Justification:
- The cost of an extra *kind* is small (one palette entry, one validator rule, one default node-type render). The property panel is locked to `name + kind` (Q4 Accepted Default), so the expensive-per-kind work — kind-specific properties like Decorator inner-kind or Parallel success threshold — is already deferred to v2.
- A narrower subset forces later users of the JSON format to choose between "upgrade the tool" and "hand-edit JSON with kinds the tool won't render," which defeats the point of a structural visualizer.
- Decorator + Parallel + SubTree have trivial structural rules (Decorator=1 child, Parallel=≥1 child, SubTree=leaf) that are easier to implement now than to retrofit.

**Alternative considered:** ship 5 kinds (Root, Sequence, Fallback, Action, Condition), defer the other 3. Cuts ~half a day off S2/S9. Not recommended — see above.

**Confirmed:** 8 kinds. Open Item A is now closed; this should be folded back into `SPEC.md` §Resolved Decisions.

### D2 — JSON format spec timing ✅ **CONFIRMED: S0 lands before any code**

SPEC.md §Open Item B says `docs/bt-json-format.md` must exist before Phase 3. It is task **S0**. Open Item B is now closed.

### D3 — Canvas visual style ✅ **CONFIRMED: default edges + single parameterized custom node**

For v1: use React Flow defaults for edges/handles; use a single custom node component parameterized by `kind` (all 8 kinds share layout, differing only in color/icon/label).

## Slice-by-slice plan

Each slice lists: **goal** (what observable capability it adds), **inputs** (what must exist first), **outputs** (files/modules produced), **acceptance** (how we verify).

---

### S0 — JSON format specification *(docs only, no code)*

- **Goal:** `docs/bt-json-format.md` defines the on-disk format: top-level shape, per-node shape, per-connection shape, `version` field, field semantics, example, and the list of structural rules that are checked at load time vs. on demand.
- **Inputs:** SPEC.md §Code Style example, §Resolved Decisions Q3, Q5.
- **Outputs:** `docs/bt-json-format.md`.
- **Acceptance:** Human review. Doc must (a) match the TypeScript types sketched in SPEC.md, (b) specify that `order` is preserved round-trip, (c) enumerate validation rules as normative.

### S0.5 — Project scaffold

- **Goal:** `npm run dev` opens a blank Vite+React+Tailwind page; `npm test` runs an empty passing Vitest suite; `npm run typecheck` and `npm run lint` both pass.
- **Inputs:** SPEC.md §Tech Stack, §Commands, §Project Structure.
- **Outputs:** `package.json`, `tsconfig.json`, `vite.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `.eslintrc.*`, `.prettierrc`, `playwright.config.ts`, `src/main.tsx`, `src/App.tsx` (empty shell), `src/styles/tailwind.css`, `tests/unit/smoke.test.ts` (one trivial assertion).
- **Acceptance:**
  - `npm install` succeeds from clean clone.
  - `npm run dev` shows Tailwind-styled "Hello" in browser.
  - `npm test`, `npm run typecheck`, `npm run lint` all green.

### S1 — Walking skeleton: Root node on canvas *(CHECKPOINT 1)*

- **Goal:** App shell renders a React Flow canvas with exactly one `Root` node on first load. Pan + zoom work (free from React Flow). Nothing else.
- **Inputs:** S0.5. D1 resolution (pre-freeze the node kind enum).
- **Outputs:**
  - `src/core/model/node.ts` (types, `NODE_KINDS`).
  - `src/core/model/tree.ts` (empty `BehaviorTree` factory with single Root).
  - `src/store/bt-store.ts` (Zustand store holding a `BehaviorTree`).
  - `src/components/canvas/Canvas.tsx` (React Flow wrapper).
  - `src/components/canvas/BTNode.tsx` (custom node, parameterized by kind).
  - Wire into `App.tsx`.
- **Acceptance:**
  - Opening `npm run dev` shows one Root node centered in a pannable, zoomable canvas.
  - `tests/unit/core/model/tree.test.ts` asserts `createEmptyTree()` returns a tree with exactly one Root node whose `id === tree.rootId`.
  - Typecheck, lint, tests green.
- **🛑 CHECKPOINT 1:** Human reviews. Does the foundation look right before we build on it?

### S2 — Create + move nodes

- **Goal:** Drag a node kind from a palette onto the canvas; drop creates a node at the drop position. Drag existing nodes to move them. Snap-to-grid on drop (16 px).
- **Inputs:** S1.
- **Outputs:**
  - `src/core/model/operations.ts` — `addNode`, `moveNode` pure functions.
  - `src/components/node-palette/NodePalette.tsx` — drag source per non-Root kind.
  - Grid config constant; snap logic in `Canvas.tsx`.
  - Unit tests for `addNode` / `moveNode`.
- **Acceptance:**
  - User can drag a `Sequence` (or any non-Root kind) from the palette onto the canvas; it appears at the drop coordinate, snapped to 16 px.
  - Dragging an existing node updates its position in the store.
  - Root cannot be added from the palette (it is not a palette entry).

### S3 — Connect + delete

- **Goal:** Draw parent→child edges by dragging between ports. Select nodes/edges and delete them (Delete/Backspace key, plus toolbar button).
- **Inputs:** S2.
- **Outputs:**
  - `src/core/model/operations.ts` extended: `connect`, `disconnect`, `removeNode` (leaves children orphaned per SPEC Success Criterion 2).
  - Selection state in store.
  - Keyboard handler for Delete/Backspace.
  - Unit tests covering the "delete non-root leaves orphans" invariant.
- **Acceptance:**
  - User can draw an edge from a parent port to a child port; a `BTConnection` is created with a fresh `order` (max-order-among-siblings + 1).
  - Selecting an edge + Delete removes the connection.
  - Selecting a non-Root node + Delete removes the node; its former children remain as orphans with no parent edge.
  - Selecting the Root + Delete is a no-op (Root is undeletable per Success Criterion 1).

### S4 — Property panel (name + kind)

- **Goal:** Clicking a node opens a right-hand panel showing its name (editable text) and kind (dropdown limited to `NODE_KINDS`, Root locked for the Root node). Changes commit to store live.
- **Inputs:** S3 (selection state).
- **Outputs:**
  - `src/components/property-panel/PropertyPanel.tsx`.
  - `updateNode` pure op in `operations.ts` + tests.
- **Acceptance:**
  - Selecting a node populates the panel; editing name updates the node label on canvas in real time.
  - Changing kind on a non-Root node updates the visual; kind dropdown for Root is disabled.
  - Component test: panel renders correctly for each kind.

### S5 — Save / Open round-trip *(CHECKPOINT 2 — demoable MVP)*

- **Goal:** Toolbar "Save" downloads the current tree as `.json`; "Open" loads a `.json` file. Round-trip is lossless per SPEC Success Criterion 7.
- **Inputs:** S4 (property panel so we can prove edits persist); S0 (format spec).
- **Outputs:**
  - `src/core/schema/bt-schema.ts` — zod schema matching `docs/bt-json-format.md`.
  - `src/core/serialization/serialize.ts` + `deserialize.ts`.
  - `src/components/toolbar/Toolbar.tsx` (Open/Save buttons).
  - Ctrl/Cmd+S, Ctrl/Cmd+O bindings.
  - Round-trip unit test (`tree → JSON → tree` is deep-equal).
- **Acceptance:**
  - Save → Open on the same tree restores every field including node positions, connections, and `order`.
  - Loading a malformed JSON shows a user-visible error (not a silent crash).
  - Schema violations are reported with zod's path (`nodes[3].kind: invalid`).
- **🛑 CHECKPOINT 2:** Human reviews. The tool is minimally demoable. Do we proceed or adjust scope?

### S6 — Undo / redo

- **Goal:** Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z redoes. Ring buffer capped at 5.
- **Inputs:** S5 (so we can verify undo doesn't break serialization).
- **Outputs:**
  - `src/core/history/ring-buffer.ts` (generic, pure, tested).
  - Store integration: every op that mutates the tree snapshots the previous tree.
  - Unit tests for ring buffer eviction at 5.
- **Acceptance:**
  - Create, move, connect, edit — each is independently undoable.
  - After 5 undoable actions, the 6th pushes out the oldest; undoing 5 times works, the 6th undo is a no-op.
  - Redo clears when a new action is taken after an undo.

### S7 — Validation panel

- **Goal:** Toolbar "Validate" button runs structural checks; results render in a panel. Clicking a result selects the offending node.
- **Inputs:** S0 (rules enumerated), S3 (selection).
- **Outputs:**
  - `src/core/validation/rules.ts` — each rule a pure function `(tree) => ValidationIssue[]`.
  - `src/core/validation/index.ts` — aggregator.
  - `src/components/validation/ValidationPanel.tsx`.
  - Table-driven unit tests (one fixture-per-rule, valid + invalid pair).
- **Acceptance (rules from SPEC Q3):**
  - Single Root with exactly one child.
  - Action/Condition are leaves.
  - Sequence/Fallback/Parallel require ≥1 child.
  - Decorator has exactly 1 child.
  - No cycles.
  - Every non-root node has exactly one parent OR is orphaned (orphans → warning).
- **UX acceptance:** Clicking a validation issue highlights the referenced node on canvas.

### S8 — Child order preservation

- **Goal:** Siblings under the same parent have a user-visible order that survives round-trip. Reordering is possible from the UI (mechanism TBD — simplest acceptable option: left-to-right canvas x-position determines `order` on save).
- **Inputs:** S5.
- **Outputs:**
  - `reorderChildren` pure op (even if UI uses x-position as the ordering input).
  - Round-trip test: create parent with 3 children in specific order → save → load → reorder semantic preserved.
- **Acceptance:**
  - Save-load-save produces byte-identical JSON for unchanged trees (stable serialization).
  - Reordering siblings (whatever UI we pick) changes `order` and survives round-trip.
- **Note:** If we choose x-position as the ordering source, document that choice in `bt-json-format.md` and flag the tradeoff (moving a node horizontally also reorders it).

### S9 — Canvas polish + any remaining node kinds *(CHECKPOINT 3)*

- **Goal:** All 8 node kinds (per D1) have palette entries, custom rendering (icon + color), and validator coverage. Canvas interactions (pan/zoom/snap) match Success Criterion 4 exactly. Ctrl/Cmd+A selects all.
- **Inputs:** S8.
- **Outputs:** Palette expansion, per-kind styling tokens, any missing rules.
- **Acceptance:** Every Success Criterion in SPEC.md §Success Criteria 1–6 and 9 passes a manual walkthrough.
- **🛑 CHECKPOINT 3:** Human reviews. All application logic is complete. Proceed to PWA + docs.

### S10 — PWA shell

- **Goal:** `npm run build` produces a PWA that installs and works offline. `manifest.webmanifest` with name/icons/theme. Service worker caches the shell.
- **Inputs:** S9.
- **Outputs:**
  - `vite-plugin-pwa` wired in `vite.config.ts`.
  - `public/manifest.webmanifest`, `public/icons/` (192, 512, maskable).
  - Runtime caching strategy: app shell = precache, no runtime network dependencies.
- **Acceptance:**
  - `npm run preview`, then DevTools → Application → Service Workers shows an active worker.
  - Kill network, refresh — app still loads.
  - Lighthouse PWA audit passes.

### S11 — Docs, E2E, final audit *(CHECKPOINT 4)*

- **Goal:** Everything ship-ready.
- **Outputs:**
  - `README.md` — 5-line quickstart (SPEC Success Criterion 10).
  - `docs/bt-json-format.md` finalized (updates from implementation surprises folded in).
  - `docs/adr/` — ADRs for major choices (Zustand over Redux, React Flow, PWA-only, child-order-via-x-position if that's the chosen mechanism).
  - `e2e/authoring.spec.ts` — Playwright: launch → create 10-node tree → validate → save → reload → verify.
  - Lighthouse audit result committed as evidence.
- **Acceptance:** Every item in SPEC.md §Success Criteria is independently verifiable. `npm run test:e2e` passes in CI.
- **🛑 CHECKPOINT 4:** Ship.

## Checkpoints (summary)

| # | After slice | What we're gating |
|---|---|---|
| 1 | S1 | Foundation: does the stack feel right before investment compounds? |
| 2 | S5 | Demoable MVP: Is the data model + round-trip correct, or do we need to adjust before piling on features? |
| 3 | S9 | Feature-complete logic: Are all 10 success criteria observable in the UI? |
| 4 | S11 | Ship-ready: Does the PWA install, run offline, and pass Lighthouse? |

**Rule:** do not start the next slice past a checkpoint without explicit human approval. Checkpoints exist to catch wrong assumptions while they're cheap.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| React Flow's API shifts in a way that makes custom-node behavior painful (e.g., we need custom edge routing for child order) | Medium | Medium | S1 walking skeleton tests the hardest integration first; if custom nodes feel wrong, we discover it before building the palette. |
| Child-order UX is awkward (x-position feels hacky; explicit "reorder" UI bloats v1) | Medium | Low-Medium | S8 is its own slice specifically to force the decision. Flagged in D3-adjacent territory. |
| Validator rule set has an edge case we didn't foresee (e.g., what's a "leaf" with no parent and no children?) | Medium | Low | Table-driven tests + S0 spec forces us to enumerate before implementing. |
| PWA caching masks real bugs during dev (stale bundle) | Low | Medium | Only enable service worker in `build`/`preview`, never `dev`. Common vite-plugin-pwa config. |
| Open Item A isn't resolved → scope creep at S9 | Medium | High | Surface D1 **now**; do not start S1 without resolution (the kind enum is baked into the model). |
| Zustand + React Flow state duplication (RF has its own nodes/edges arrays) | Medium | Medium | Canonical state = our `BehaviorTree` in Zustand; React Flow state is derived on every render via selectors. Document this in an ADR in S11. |

## What's explicitly out of scope for v1

- Any kind-specific property editing (Decorator inner-kind, Parallel thresholds). → v2.
- BehaviorTree.CPP XML import/export. → v2+.
- Tick/execution simulation. → non-goal.
- Multi-file / project management. → non-goal.
- Telemetry, analytics, remote anything. → non-goal.

## What happens next

1. ~~Human confirms D1, D2, D3.~~ ✅ Done 2026-04-22.
2. **Agent starts S0** (`docs/bt-json-format.md`). No code yet.
3. Human reviews S0.
4. S0.5 (scaffold) → S1 (walking skeleton).
5. Stop at **CHECKPOINT 1** for review.

**Housekeeping owed (not blocking S0):** fold the D1 resolution into `SPEC.md` §Resolved Decisions (close Open Item A) and the D2 resolution (close Open Item B) so SPEC.md stays the source of truth.
