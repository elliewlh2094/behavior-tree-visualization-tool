# Todo: Behavior Tree Visualization Tool — v1

> Derived from `tasks/plan.md`. If this drifts from the plan, regenerate from the plan.
> Legend: `[ ]` not started · `[~]` in progress · `[x]` done · 🛑 = checkpoint (requires human approval to pass)

## Pre-start — decisions (all confirmed 2026-04-22)

- [x] **D1** — v1 ships all 8 node kinds.
- [x] **D2** — S0 (`docs/bt-json-format.md`) lands before any code.
- [x] **D3** — React Flow default edges + single parameterized custom node.
- [x] **Housekeeping** (not blocking): fold D1/D2 resolutions into `SPEC.md` to close Open Items A and B. *(verified 2026-04-25: SPEC.md lines 210, 230–231 already reflect D1 (8 kinds) and D2 (`docs/bt-json-format.md`); SPEC.md line 228 notes no items currently open. Checkbox was stale.)*

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

- [x] `src/core/schema/bt-schema.ts` — zod schema matching `bt-json-format.md` (23 tests; strict shapes + cross-ref checks).
- [x] `src/core/serialization/serialize.ts` + `deserialize.ts` (canonical key order, discriminated Result).
- [x] `src/components/toolbar/Toolbar.tsx` — Open, Save buttons (mounted above 3-column layout).
- [x] Ctrl/Cmd+S, Ctrl/Cmd+O bindings (global `keydown`, always `preventDefault`).
- [x] Round-trip test: `tree → JSON → tree` deep-equal.
- [x] Save → load → save byte-identical test (format §4.1 invariant).
- [x] Malformed-JSON error path test + schema error path test (with field path rendering).

**Verify:**
- [x] Save → Open restores every field including positions, connections, `order`. *(human-verified 2026-04-23)*
- [x] Malformed JSON shows a user-visible error (no crash). *(human-verified 2026-04-23)*
- [x] Zod errors report the field path. *(human-verified 2026-04-23)*
- [x] 🛑 **CHECKPOINT 2** — demoable MVP. *(passed 2026-04-23)*

---

## S6 — Undo / redo

- [x] `src/core/history/ring-buffer.ts` — generic, pure, tested (16 tests; cap = 10 as of 2026-04-24, raised from 5).
- [x] Store integration: snapshot previous tree on every mutating op (except `moveNode`, which is gesture-scoped via `beginGesture()` fired from React Flow `onNodeDragStart`).
- [x] Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z bindings.

**Verify:**
- [x] Create/move/connect/edit each independently undoable. *(11 store history tests; human-verified 2026-04-23)*
- [x] After 10 actions, 11th evicts the oldest; 11th undo is a no-op. *(unit tests + human-verified 2026-04-23; capacity raised 5 → 10 on 2026-04-24)*
- [x] New action after undo clears the redo stack. *(unit tests + human-verified 2026-04-23)*
- [x] Bonus: drag gesture is one undo step (not per-frame). *(human-verified 2026-04-23)*
- [x] ~~Known limitation: per-keystroke typing creates one snapshot per character.~~ **Resolved 2026-04-24**: name edits are gesture-scoped (store `updateNodeName` no longer snapshots; `PropertyPanel` calls `beginGesture()` on the first keystroke per focus session and resets on blur). One rename = one undo step. Kind changes still snapshot via `updateNodeKind`.

---

## S7 — Validation panel

- [x] `src/core/validation/types.ts` — `ValidationIssue`, `Severity`, `RuleId`.
- [x] `src/core/validation/rules.ts` — one pure fn per rule (R1–R8 per `docs/bt-json-format.md` §5).
- [x] `src/core/validation/index.ts` — `validate(tree)` aggregator returning `ValidationIssue[]`.
- [x] `src/components/validation/ValidationPanel.tsx` — bottom drawer, sorted errors-first; click issue → selects offending node.
- [x] Toolbar "Validate" button + store `runValidation()` / `closeValidationPanel()`. `setTree` (Open) clears issues.
- [x] Table-driven tests: one valid + one invalid fixture per rule (22 tests).

**Rules to cover (adopted from `bt-json-format.md` §5 R1–R8 — richer than the SPEC Q3 summary):**
- [x] R1: Exactly one Root; its `id === rootId`.
- [x] R2: Root has exactly one child.
- [x] R3: Action / Condition are leaves.
- [x] R4: Sequence / Fallback / Parallel have ≥1 child.
- [x] R5: Decorator has exactly 1 child.
- [x] R6: No cycles (DFS 3-color).
- [x] R7: Every non-Root has ≤1 parent (error if >1).
- [x] R8: Orphaned non-Root nodes → warning.

**Verify:**
- [x] Clicking an issue selects the offending node on canvas. *(human-verified 2026-04-23)*
- [x] Empty-state "No structural issues detected." aligned top-left. *(human-verified 2026-04-23)*
- [x] `SubTree` → `Group` rename: palette, property-panel dropdown, and save→open round-trip all clean. *(human-verified 2026-04-23; see SPEC.md Q2 rename note)*

---

## S8 — Child order preservation

- [x] `reorderChildren(tree, parentId, orderedChildIds)` pure op — validates + renumbers to 0..n-1; returns same ref on no-op (8 unit tests).
- [x] User-facing mechanism decided + documented: **D1 — horizontal position auto-syncs to order** at drag end (see `docs/bt-json-format.md` §4.2, added 2026-04-24).
- [x] Round-trip test: 3 ordered siblings reordered via `reorderChildren`, serialize→deserialize preserves new contiguous orders.
- [x] Test: save-load-save produces byte-identical JSON for unchanged trees. *(already covered by S5 test in `serialization.test.ts:94`.)*
- [x] Store `reorderChildren` action (no history snapshot, same pattern as `moveNode`).
- [x] Canvas `onNodeDragStop` reads fresh store state, sorts siblings by `position.x`, calls store action.

**Verify:**
- [x] Reorder siblings → `order` updates → round-trip preserves new order. *(round-trip unit test + human-verified 2026-04-24: baseline, reorder-by-drag, undo-covers-both, orphan-harmless)*

---

## S9 — Canvas polish + remaining node kinds 🛑

- [x] All 8 kinds have palette entries (per D1). *(completed incidentally in S1: `NODE_KINDS` frozen at 8; `NodePalette.tsx` renders the 7 non-Root kinds; property-panel dropdown matches.)*
- [x] Per-kind icon + color tokens. *(kind-visuals.ts + kind-icons.tsx; edge selection styling in Canvas.tsx; axes softened to match grid. Human-verified 2026-04-24.)*
- [x] Any remaining validator rules for kinds added late. *(completed in S7: R1–R8 already cover all 8 kinds; `Group` intentionally excluded from leaf/branch rules per `rules.ts:4-5`.)*
- [x] Ctrl/Cmd+A selects all. *(human-verified 2026-04-24)*
- [x] Multi-select (shift-click, box-select) for nodes and edges; Delete removes all selected. *(Moved from S3 on 2026-04-22 — S3 ships single-select only. Human-verified 2026-04-24: shift-click, shift-drag box-select over nodes, Ctrl/Cmd+A, multi-delete as one undo step. Incidental polish: source handle removed on Action/Condition leaves; property panel shows "N nodes, M edges selected" with per-kind counts.)*
- [x] Manual walkthrough of SPEC Success Criteria 1–6 and 9. *(human-verified 2026-04-24)*

**Verify:**
- [x] Every listed success criterion demonstrably passes. *(SC-1, SC-2, SC-3, SC-4, SC-5, SC-6, SC-9 — human-verified 2026-04-24)*
- [x] 🛑 **CHECKPOINT 3** — logic-complete. Human review before PWA phase. *(passed 2026-04-24)*

---

## S10 — PWA shell

- [x] `vite-plugin-pwa` wired in `vite.config.ts` (generateSW, autoUpdate, navigateFallback = index.html).
- [x] Manifest generated from plugin config (name, short_name, theme/bg color, start_url/scope, icons[4]). Emitted to `dist/manifest.webmanifest` at build.
- [x] `public/icons/` — icon-192, icon-512, icon-maskable-192, icon-maskable-512. Regeneratable via `npm run icons` (reads `public/icon.png` through `scripts/gen-pwa-icons.mjs`, sharp-based, maskable = 80% safe-zone on white).
- [x] Precache app shell; no runtime network dependencies. (9 entries, 437 KiB — HTML, CSS, JS chunk, workbox-window, 4 icons, manifest; no duplicates.)
- [x] Service worker only in `build`/`preview`, never `dev`. (`devOptions.enabled: false`.)

**Verify:**
- [x] `npm run preview` → DevTools shows registered service worker. *(human-verified 2026-04-24 in Firefox; "Stopped" = idle-registered per Firefox UX)*
- [x] Offline refresh still loads the app. *(human-verified 2026-04-24: preview server killed, plain Ctrl+R reload → full canvas/palette/Root rendered from cache; shift-reload bypasses SW by spec so was intentionally not used)*
- [ ] Lighthouse PWA audit passes. *(optional bonus; defer to S11 final audit)*

---

## S11 — Docs, E2E, final audit 🛑

- [x] `README.md` — 5-line quickstart.
- [x] Finalize `docs/bt-json-format.md` (fold in implementation surprises).
- [x] `docs/adr/` — ADRs for: Zustand, React Flow, PWA-only, child-order mechanism.
- [x] `e2e/authoring.spec.ts` — launch → 10-node tree → validate → save → reload → verify.
- [x] Commit Lighthouse audit output. *(Performance 99, Accessibility 100, Best Practices 100, SEO 82; PWA category removed in Lighthouse 12+, PWA functionality verified in S10)*

**Verify:**
- [ ] Every SPEC.md §Success Criteria item independently verified.
- [ ] `npm run test:e2e` passes.
- [ ] 🛑 **CHECKPOINT 4** — ship.
