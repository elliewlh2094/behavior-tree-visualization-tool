# Spec: v1.8 — SubTree Hardening & Canvas Polish

> Status: **Drafted 2026-05-11.** Awaiting review.
> Source: `docs/ideas/v1.8-v1.10-batch.md`

## Objective

Close out user-reported papercuts after v1.7.1 ship. Three bug fixes (B1–B3) plus three small UX improvements (FB1, FB2, FB4). Zero data-model changes; zero new dependencies.

## Features

### B1 — SubTree name is non-editable

A SubTree node's identity *is* the referenced tree's name (per v1.4 T9 invariant). Editing the SubTree's name in PropertyPanel currently calls `renameTree()` per keystroke — typing or deleting characters renames the referenced tree's tab, and clearing the field renames the tree to `""`, which breaks every other SubTree that referenced it.

**Fix:** Replace the editable `<input>` for `selectedNode.kind === 'SubTree'` with a read-only display. All renaming of the referenced tree happens via the tab (double-click).

**User-visible behavior:**

- PropertyPanel for a SubTree node:
  - Read-only **Name** row showing the referenced tree's name (or `(no reference)` when `treeRef` is unset/missing).
  - Existing **Tree Reference** dropdown stays as-is.
  - Existing **Kind** select stays disabled-but-displayed.
  - New **Open Subtree** button — see FB4 below.
- BTNode body rendering: **unchanged**. Already shows `name || kind` on top + kind chip. For a synced SubTree, this surfaces the tree name; for an unset SubTree it shows the literal "SubTree".
- Tab double-click rename remains the single rename surface.

**Acceptance criteria:**

- AC1.1: Selecting a SubTree node renders a read-only `<p>` (or `<div>`) for the Name row, **not** an `<input>`.
- AC1.2: When `treeRef` is unset or refers to a missing tree, the Name row shows `(no reference)` in muted text (`text-slate-400 dark:text-slate-500`); a help line below reads `Rename the referenced tree from its tab.`.
- AC1.3: When `treeRef` resolves to an existing tree, the Name row shows that tree's `name`.
- AC1.4: Renaming the referenced tree via tab double-click updates the SubTree's PropertyPanel Name row in the same render pass (already true since `renameTree` reactively updates all referrers).
- AC1.5: The PropertyPanel's `nameGestureOpen` ref logic (line 110–118) is unchanged for non-SubTree paths.

### B2 — Per-keystroke undo on SubTree rename

**Fixed automatically by B1.** Verified in `PropertyPanel.tsx` line 95–115: only the SubTree branch (line 100–109) lacks gesture batching. Non-SubTree input already uses `beginGesture()` once per typing burst. No additional change required.

**Acceptance criteria:**

- AC2.1: After B1 lands, no path in PropertyPanel calls `renameTree` per keystroke.
- AC2.2: A regression test confirms that typing 5 characters into an Action node's Name field produces exactly 1 undo step (the existing gesture behavior).

### B3 — `npm run preview` SW caching breaks subsequent visits

`vite-plugin-pwa` registers a service worker with `registerType: 'autoUpdate'` for the production build. `npm run preview` serves that build at `localhost:4173` and the SW caches it. After Ctrl+C, the SW remains in the browser's storage; revisiting `localhost:4173` later (with no preview server running) serves stale cached HTML pointing at hashed asset paths the dev server doesn't know about — the logo (referenced by hashed path in the cached bundle) fails.

**Fix:** Pragmatic, scope-narrow.

1. Add a **`preview:dev`** script to `package.json` that builds and serves *without* the PWA plugin (skip `vite preview`'s SW registration). Use a vite mode flag (`--mode no-pwa`) and add a guard in `vite.config.ts`: `plugins: [..., mode !== 'no-pwa' && VitePWA({...})].filter(Boolean)`.
2. Update **`README.md`** and **`user-guide.md`** to recommend `npm run dev` for local verification, and `npm run preview` only when explicitly testing PWA behavior.
3. Add a **Troubleshooting** subsection in `README.md`: "If the logo or assets fail to load on `localhost:4173` after killing `npm run preview`, unregister the service worker via DevTools → Application → Service Workers → Unregister, then hard-refresh."

**Acceptance criteria:**

- AC3.1: `vite.config.ts` accepts a `--mode no-pwa` flag and conditionally omits the `VitePWA` plugin.
- AC3.2: `package.json` has a `preview:dev` script: `"vite build --mode no-pwa && vite preview"`.
- AC3.3: README has a Troubleshooting line for SW staleness.
- AC3.4: Existing `npm run preview` continues to work for PWA testing (no behavior change for users explicitly testing the PWA build).

### FB1 — Layout button fits the entire tree

Layout currently does `computeTreeLayout` + `setCenter(rootX, rootY) + getZoom()` (v1.2 commit `cd62840`). User feedback: the "fit view" semantics (frame the whole tree) is what they expect.

**Fix:** Keep `computeTreeLayout` re-positioning. Replace `setCenter(...) + getZoom()` with `fitView({ padding: 0.2, duration: 200 })`.

**Acceptance criteria:**

- AC4.1: Pressing Layout on a multi-node tree centers and zooms so the bounding box of all nodes is visible with ≥10% padding on each side.
- AC4.2: Pressing Layout on a single-node tree centers the node without zooming above 1.0× (xyflow's `fitView` default behavior).
- AC4.3: After Layout, the per-tab viewport store (`viewportByTreeId`) reflects the new viewport (already wired via `onViewportChange` in `Canvas.tsx`).
- AC4.4: Layout button still pushes one history snapshot for the position changes (existing behavior in `applyLayout` action).

### FB2 — Display current zoom level

Add a small chip in the bottom-right of the canvas showing the current zoom as a percentage. Click resets to 100%.

**UI placement:**

- xyflow `<Panel position="bottom-right">` containing a `<button>` with the zoom percent text.
- Format: `100%`, `42%`, `213%` (rounded to nearest integer).
- Updates on every `onViewportChange` event.
- Click → `setViewport({ x, y, zoom: 1 }, { duration: 200 })` preserving x/y.

**Acceptance criteria:**

- AC5.1: A pill-shaped button labeled `N%` appears in the bottom-right corner of the canvas, layered above the node graph but visually distinct from the React Flow `<Controls />` overlay (which lives bottom-left).
- AC5.2: The label updates when the user wheel-zooms, pinches, or pans (zoom unchanged → label unchanged).
- AC5.3: Clicking the chip resets zoom to 1.0 with a 200ms easing (preserve x/y so it doesn't teleport).
- AC5.4: The chip is keyboard-focusable (`<button>` with `aria-label="Zoom: NN percent. Click to reset to 100%"`) and matches existing button design tokens.
- AC5.5: Dark-mode styling matches the existing `<Controls />` overlay tokens.

### FB4 — Open Subtree button in PropertyPanel

When a SubTree node is selected and its `treeRef` resolves to an existing tree, show a button that switches the active tab to that tree.

**UI:**

- Button placed under the **Tree Reference** dropdown.
- Label: `Open subtree ↗`.
- Disabled when `treeRef` is unset or refers to a missing tree (uses the existing `refExists` check at PropertyPanel.tsx:151).
- On click: `setActiveTreeId(refTree.id)` + `clearSelection()`.

**Acceptance criteria:**

- AC6.1: The button appears only when `selectedNode.kind === 'SubTree'`.
- AC6.2: The button is disabled (`opacity-50 cursor-not-allowed`) when `refExists === false`.
- AC6.3: Clicking the button switches `activeTreeId` to `refTree.id` and clears selection (per the existing `setActiveTreeId` semantics in `bt-store.ts:230`).
- AC6.4: After click, the destination tab is visibly active in the TabBar; the canvas renders the destination tree.
- AC6.5: Tab switch does **not** push a history snapshot (matches existing `setActiveTreeId` behavior).

## Files Modified

| File | Change |
|------|--------|
| `src/components/property-panel/PropertyPanel.tsx` | B1: replace SubTree name `<input>` with read-only display. FB4: add Open Subtree button. |
| `src/components/canvas/Canvas.tsx` | FB2: add `<Panel position="bottom-right">` zoom chip with click-to-reset. |
| `src/hooks/useApplyLayout.ts` | FB1: replace `setCenter+getZoom` with `fitView({ padding: 0.2, duration: 200 })`. |
| `vite.config.ts` | B3: conditional `VitePWA` based on `mode === 'no-pwa'`. |
| `package.json` | B3: add `preview:dev` script. |
| `README.md` | B3: troubleshooting subsection. |
| `user-guide.md` | B3: note `npm run dev` is canonical. |
| `tests/component/PropertyPanel.test.tsx` | New tests for AC1.1–1.5, AC6.1–6.5. |
| `tests/unit/bt-store-rename.test.ts` (or extend existing) | Regression test for AC2.2. |
| `e2e/multi-tree.spec.ts` | New spec or extend existing: AC1, AC6 user flow. |

## Files NOT Modified

- `src/components/canvas/BTNode.tsx` — no change. Existing `name || kind` rendering already correct for SubTree (per A1 finding).
- `src/store/bt-store.ts` — no new actions; reuse `setActiveTreeId`, `clearSelection`.
- `src/core/model/operations.ts` — no data-model change.
- `docs/bt-json-format.md` — no schema change.

## Boundaries

**Always do:**
- Keep B1's PropertyPanel branch reads `selectedNode.kind === 'SubTree'` only — don't gate on `treeRef` existence (the read-only row should appear even when reference is unset, with the placeholder text).
- B2 regression test must use a non-SubTree node (Action) to verify gesture batching still works.

**Ask first:**
- If FB2's chip placement collides with the (deferred) v1.10 Move/Copy modal trigger.
- If FB1's `padding: 0.2` produces awkward framing on very deep trees — adjust empirically.

**Never do:**
- Add a "rename SubTree from PropertyPanel" affordance back. Single rename surface (the tab) is the post-B1 invariant.
- Block, depend on, or partially refactor `BTNode.tsx` for SubTree rendering.

## Testing Strategy

| Level | What to test |
|-------|-------------|
| Unit (Vitest) | `useApplyLayout` calls `fitView` (mock useReactFlow). Zoom-chip percent formatter (boundary: 0.42 → "42%", 1 → "100%", 2.13 → "213%"). |
| Component (RTL) | PropertyPanel: SubTree shows read-only Name row (AC1); Open Subtree button enable/disable + click action (AC6). Zoom chip click resets viewport. |
| E2E (Playwright) | Select SubTree → no editable Name input visible → click Open Subtree → destination tab activates. Zoom in via wheel → chip label updates. Click chip → zoom returns to 100%. |

## Success Criteria (v1.8)

1. **B1:** No way to break a SubTree's referenced-tree name through the SubTree node's PropertyPanel.
2. **B2:** Renaming an Action node's name via 5 keystrokes produces 1 undo step (verified by automated test).
3. **B3:** Documented workflow (or new `preview:dev` script) prevents the SW-cache logo issue without requiring users to know about service workers.
4. **FB1:** Layout button frames the entire tree with comfortable padding, not just the Root.
5. **FB2:** Zoom level is always visible in the bottom-right; click resets to 100%.
6. **FB4:** Single-click navigation from a SubTree node to its referenced tree, gated by reference existence.
7. **No regressions:** All v1.7.1 unit + e2e tests still pass.

## Out of Scope

- Renaming a SubTree from any surface other than the tab.
- Image export, Move/Copy, tab reordering — those are v1.9/v1.10.
- Refactoring `BTNode.tsx` for any kind-specific rendering.
- Changing PWA strategy (deferred — only documenting the gotcha).
