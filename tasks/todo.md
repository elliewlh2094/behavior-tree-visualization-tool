# Todo: Behavior Tree Visualization Tool — v1

> Derived from `tasks/plan.md`. If this drifts from the plan, regenerate from the plan.
> Legend: `[ ]` not started · `[~]` in progress · `[x]` done · 🛑 = checkpoint (requires human approval to pass)

## Pre-start — decisions (all confirmed 2026-04-22)

- [x] **D1** — v1 ships all 8 node kinds.
- [x] **D2** — S0 (`docs/bt-json-format.md`) lands before any code.
- [x] **D3** — React Flow default edges + single parameterized custom node.
- [ ] **Housekeeping** (not blocking): fold D1/D2 resolutions into `SPEC.md` to close Open Items A and B.

---

## S0 — JSON format spec

- [x] Draft `docs/bt-json-format.md` covering: top-level shape, node shape, connection shape, `version` field, `order` semantics, example, list of structural rules.
- [x] Verify every field in the doc matches the TS types sketched in SPEC.md §Code Style.
- [x] Close Open Items A and B in SPEC.md.
- [x] Human review and sign-off on the format before S0.5. *(signed off 2026-04-22)*

**Verify:** Doc exists, passes human review. ✅

---

## S0.5 — Project scaffold

- [x] `npm init` + install: React 18, TypeScript, Vite, `@xyflow/react`, Zustand, Tailwind, Vitest, React Testing Library, Playwright (package only, browsers deferred to S11 per SD1), ESLint, Prettier, zod, `vite-plugin-pwa` (installed, not wired up until S10).
- [x] `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `eslint.config.js` (flat config for ESLint 9), `.prettierrc`, `playwright.config.ts`, `index.html`.
- [x] `src/main.tsx`, `src/App.tsx` (empty shell), `src/styles/tailwind.css`.
- [x] `tests/setup.ts` (jest-dom matchers), `tests/unit/smoke.test.ts` — one trivial assertion.
- [x] All npm scripts from SPEC.md §Commands wired.

**Verify:**
- [x] `npm install` succeeds (674 packages, 22s).
- [x] `npm run dev` renders a Tailwind-styled "Hello" in browser. *(human-verified 2026-04-22)*
- [x] `npm test` green (1/1 pass).
- [x] `npm run typecheck` green.
- [x] `npm run lint` green.
- [x] `npm run build` green (142 KB JS, 5.16 KB CSS — Tailwind compiling).

---

## S1 — Walking skeleton: Root on canvas 🛑

- [x] `src/core/model/node.ts` — `NODE_KINDS`, `BTNode`, `BTConnection`, `BehaviorTree`.
- [x] `src/core/model/tree.ts` — `createEmptyTree()` returns a tree with single Root.
- [x] `src/store/bt-store.ts` — Zustand store wrapping `BehaviorTree`.
- [x] `src/components/canvas/BTNode.tsx` — custom node, parameterized by kind.
- [x] `src/components/canvas/Canvas.tsx` — React Flow wrapper reading from store.
- [x] Wire into `App.tsx`.
- [x] `tests/unit/core/model/tree.test.ts` — assert `createEmptyTree()` has one Root with `id === rootId`.

**Verify:**
- [x] `npm run dev` shows one Root node centered in a pannable/zoomable canvas. *(human-verified 2026-04-22)*
- [x] Typecheck, lint, tests green.
- [x] 🛑 **CHECKPOINT 1** — human review before S2. *(passed 2026-04-22; SPEC Q9 added for canvas Controls overlay)*

---

## S2 — Create + move nodes

- [x] `src/core/model/operations.ts` — `addNode`, `moveNode` (pure).
- [x] `src/components/node-palette/NodePalette.tsx` — drag source per non-Root kind.
- [x] Snap-to-grid logic in `Canvas.tsx`, grid size const = 25 (revised from 16 after S2 visual review).
- [x] Unit tests for `addNode`, `moveNode`.
- [x] Fixed node dimensions (150×75 = 6×3 grid cells) so every edge lands on a grid line.
- [x] Live drag commits position to store every frame (undo-history batching deferred to S6).

**Verify:**
- [x] Drag a kind from palette → drops at cursor, snapped to 25 px. *(human-verified 2026-04-22)*
- [x] Dragging existing node updates its position in the store (with live preview). *(human-verified 2026-04-22)*
- [x] Root is not a palette entry. *(human-verified 2026-04-22)*

---

## S3 — Connect + delete

- [x] Extend `operations.ts` — `connect`, `disconnect`, `removeNode` (orphans children).
- [x] Selection state in store (single-slot `{type, id}`; multi-select deferred to S9).
- [x] Delete/Backspace keyboard handler (via React Flow `deleteKeyCode` + `onBeforeDelete` to protect Root).
- [x] Unit tests: "delete non-root leaves orphans" invariant.
- [x] Unit test: Root delete is a no-op.
- [x] Bonus: `connect` rejects self-loops and exact-duplicate edges (validator catches other structural issues in S7).
- [x] Bonus: node selection visual (blue border + ring); Root-delete vetoed via `onBeforeDelete` so incident edges survive.

**Verify:**
- [x] Draw parent→child edge; connection appears with `order = max-sibling + 1`. *(human-verified 2026-04-23)*
- [x] Select edge + Delete removes it. *(human-verified 2026-04-23)*
- [x] Select non-Root node + Delete removes it; children become orphans. *(human-verified 2026-04-23)*
- [x] Select Root + Delete → no change (node and incident edges both preserved). *(human-verified 2026-04-23)*

---

## S4 — Property panel (name + kind)

- [x] `src/components/property-panel/PropertyPanel.tsx`.
- [x] `updateNode` pure op + tests (7 tests; rejects Root kind change; allows Root rename).
- [x] Wire selection → panel (reads `selection` and `tree.nodes` from store; edge/empty selection → empty state).
- [x] Component test: renders correctly per kind; Root's kind dropdown is disabled (6 RTL tests).

**Verify:**
- [x] Click a node → panel populates. *(human-verified 2026-04-23)*
- [x] Edit name → canvas label updates live. *(human-verified 2026-04-23)*
- [x] Change kind on non-Root → visual updates; Root kind dropdown locked. *(human-verified 2026-04-23)*
- [x] Bonus: Backspace-in-input does not delete the node (React Flow treats inputs as focus targets). *(human-verified 2026-04-23)*

---

## S5 — Save / Open round-trip 🛑

- [ ] `src/core/schema/bt-schema.ts` — zod schema matching `bt-json-format.md`.
- [ ] `src/core/serialization/serialize.ts` + `deserialize.ts`.
- [ ] `src/components/toolbar/Toolbar.tsx` — Open, Save buttons.
- [ ] Ctrl/Cmd+S, Ctrl/Cmd+O bindings.
- [ ] Round-trip test: `tree → JSON → tree` deep-equal.
- [ ] Malformed-JSON error path test.

**Verify:**
- [ ] Save → Open restores every field including positions, connections, `order`.
- [ ] Malformed JSON shows a user-visible error (no crash).
- [ ] Zod errors report the field path.
- [ ] 🛑 **CHECKPOINT 2** — demoable MVP. Human review before S6–S8.

---

## S6 — Undo / redo

- [ ] `src/core/history/ring-buffer.ts` — generic, pure, tested (cap = 5).
- [ ] Store integration: snapshot previous tree on every mutating op.
- [ ] Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z bindings.

**Verify:**
- [ ] Create/move/connect/edit each independently undoable.
- [ ] After 5 actions, 6th evicts the oldest; 6th undo is a no-op.
- [ ] New action after undo clears the redo stack.

---

## S7 — Validation panel

- [ ] `src/core/validation/rules.ts` — one pure fn per rule.
- [ ] `src/core/validation/index.ts` — aggregator returning `ValidationIssue[]`.
- [ ] `src/components/validation/ValidationPanel.tsx`.
- [ ] Toolbar "Validate" button.
- [ ] Table-driven tests: one valid + one invalid fixture per rule.

**Rules to cover (from SPEC Q3):**
- [ ] Single Root with exactly one child.
- [ ] Action/Condition are leaves.
- [ ] Sequence/Fallback/Parallel have ≥1 child.
- [ ] Decorator has exactly 1 child.
- [ ] No cycles.
- [ ] Every non-root node has exactly one parent OR is orphaned (warning).

**Verify:**
- [ ] Clicking an issue selects the offending node on canvas.

---

## S8 — Child order preservation

- [ ] `reorderChildren` pure op.
- [ ] Decide + document the user-facing reorder mechanism in `bt-json-format.md`.
- [ ] Round-trip test: 3 ordered siblings survive save/load.
- [ ] Test: save-load-save produces byte-identical JSON for unchanged trees (stable serialization).

**Verify:**
- [ ] Reorder siblings → `order` updates → round-trip preserves new order.

---

## S9 — Canvas polish + remaining node kinds 🛑

- [ ] All 8 kinds have palette entries (per D1).
- [ ] Per-kind icon + color tokens.
- [ ] Any remaining validator rules for kinds added late.
- [ ] Ctrl/Cmd+A selects all.
- [ ] Multi-select (shift-click, box-select) for nodes and edges; Delete removes all selected. *(Moved from S3 on 2026-04-22 — S3 ships single-select only.)*
- [ ] Manual walkthrough of SPEC Success Criteria 1–6 and 9.

**Verify:**
- [ ] Every listed success criterion demonstrably passes.
- [ ] 🛑 **CHECKPOINT 3** — logic-complete. Human review before PWA phase.

---

## S10 — PWA shell

- [ ] `vite-plugin-pwa` wired in `vite.config.ts`.
- [ ] `public/manifest.webmanifest` — name, theme, icons.
- [ ] `public/icons/` — 192, 512, maskable.
- [ ] Precache app shell; no runtime network dependencies.
- [ ] Service worker only in `build`/`preview`, never `dev`.

**Verify:**
- [ ] `npm run preview` → DevTools shows active service worker.
- [ ] Offline refresh still loads the app.
- [ ] Lighthouse PWA audit passes.

---

## S11 — Docs, E2E, final audit 🛑

- [ ] `README.md` — 5-line quickstart.
- [ ] Finalize `docs/bt-json-format.md` (fold in implementation surprises).
- [ ] `docs/adr/` — ADRs for: Zustand, React Flow, PWA-only, child-order mechanism.
- [ ] `e2e/authoring.spec.ts` — launch → 10-node tree → validate → save → reload → verify.
- [ ] Commit Lighthouse audit output.

**Verify:**
- [ ] Every SPEC.md §Success Criteria item independently verified.
- [ ] `npm run test:e2e` passes.
- [ ] 🛑 **CHECKPOINT 4** — ship.
