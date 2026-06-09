# Spec: v1.10 — Cross-Tree Composition (Tab Reorder + Move/Copy)

> Status: **Implementation complete 2026-06-09 (T1–T9), awaiting ship 🛑 sign-off.** Phase A (FB3) shipped + pushed; Phase B (FR2) committed (`006cb64`…`d2393d4`). 441 unit / 48 e2e green. Flip to SHIPPED after manual smoke + human sign-off.
> Source: `docs/ideas/v1.8-v1.10-batch.md`

## Objective

Two features that together let users compose larger workflows from existing trees:

- **FB3 — Tab reordering:** browser-style drag-to-reorder the tab strip. Lands first so that v1.10's Move/Copy destination picker reflects user-meaningful tab order.
- **FR2 — Cross-tree Move/Copy:** select N nodes in one tab → pick a destination tab → choose Move or Copy → execute.

Highest-risk release in the v1.8–v1.10 batch: FR2 is the first action since v1.7.1's unified-timeline ship that *intentionally* mutates two trees in a single snapshot.

## Phase A — FB3: Tab Reordering

### User flow

1. Press-and-drag any tab in the tab strip horizontally.
2. While dragging, a visual placeholder shows the drop position; other tabs slide to make room.
3. Drop on a valid position → tabs reorder; the dragged tab stays active.
4. Drop outside the strip → no change (drag canceled).
5. ESC during drag → drag canceled.

### Implementation

- Library: **`@dnd-kit/sortable`** (~9 KB gzipped) plus core `@dnd-kit/core`. Chosen over native HTML5 DnD for accessibility (keyboard reorder, screen reader announcements) and to match modern React patterns. Total dep cost ~25 KB gzipped.
- Reorder changes the order of `BTDocument.trees` array. The TabBar already iterates this array; the rename and × actions key off `trees[i].id`, not array index, so no follow-on changes.
- Single `withSnapshot` push per drop (one undo step undoes the reorder).
- Drag handle: **entire tab body**, except:
  - The × close button (existing).
  - The rename input (when active — already in input mode).

### Acceptance criteria

- AC-A1: Press-and-drag any tab horizontally; other tabs animate to indicate drop position.
- AC-A2: Drop in a new position reorders `BTDocument.trees`. The active tab is unchanged.
- AC-A3: Reorder pushes one history snapshot; Ctrl+Z reverts to the previous order.
- AC-A4: Drag canceled (drop outside strip, ESC) leaves order unchanged; no history push.
- AC-A5: Clicking the × on a tab does not initiate a drag (event stopped before DnD library sees it).
- AC-A6: Double-clicking a tab to rename does not initiate a drag.
- AC-A7: Keyboard reorder works — focus a tab, press Space/Enter to lift, arrow keys to move, Space/Enter to drop. (`@dnd-kit/sortable` provides this OOTB; verify in build.)
- AC-A8: Mobile/touch drag works (`@dnd-kit/core` `TouchSensor`).
- AC-A9: Reorder of overflowing tabs works inside the existing `overflow-x-auto` scroll wrapper (v1.4 T11).

## Phase B — FR2: Cross-Tree Move/Copy

### User flow

1. Select one or more nodes in the active tab (Shift+click, box-select, or Ctrl+A — all existing v1.4/v1.5 affordances).
2. Click the **Move / Copy** Toolbar button (icon: `arrow-right-circle` or similar; tooltip: "Move or copy selection to another tree…"). Button is enabled only when ≥ 1 node is selected.
3. Modal opens with:
   - **Destination** dropdown: lists all trees *other than* the active one, in current tab order.
   - **Mode** radio: `Move` (default) | `Copy`.
   - **Summary** text: "Moving N nodes, M edges. K boundary edges will be dropped." (or "Copying ...")
   - **Validation messages** (if any) — block Confirm.
   - **Confirm** primary button, **Cancel** secondary.
4. On Confirm:
   - The mutation lands as a single `withSnapshot` push.
   - `activeTreeId` switches to the destination tree.
   - The transferred nodes are selected in the destination.
   - Modal closes.

### Semantics

| Aspect | Move | Copy |
|--------|------|------|
| Node IDs | Preserved | Regenerated (via existing `duplicateSelection` ID-mapping logic) |
| Source tree | Selected nodes + their edges removed | Unchanged |
| Destination tree | Selected nodes + edges added | Selected nodes + edges added |
| Boundary edges (selected → unselected) | Dropped silently (v1.5 precedent) | Dropped silently |
| Connection IDs | Preserved (Move) / Regenerated (Copy) | (see above) |
| Positions | Preserved verbatim | Preserved verbatim (the user can adjust after) |
| Active tab after | Switches to destination | Switches to destination |
| Selection after | Transferred nodes selected | Newly-created copies selected |
| History | One snapshot | One snapshot |

### Validation rules

Validation blocks Confirm with inline messages in the modal:

- **V1 — Root conflict:** If the selection contains a Root node and the destination tree already has a Root, Confirm is disabled. Message: "Destination tree already has a Root. Remove the destination's Root first, or unselect this Root."
- **V2 — Cycle prevention:** If the selection contains a SubTree node whose `treeRef` resolves to the destination tree (or any tree that transitively references the destination), Confirm is disabled. Message: "Selection includes a SubTree referencing the destination — would create a cycle."
- **V3 — Empty selection:** Modal cannot open with zero nodes selected (button disabled at the Toolbar level).
- **V4 — No destinations:** If the document has only one tree, the Toolbar button is disabled with tooltip "Add another tree to enable move/copy."

### Acceptance criteria

- AC-B1: Toolbar button is enabled iff `selection.nodeIds.size >= 1` AND `document.trees.length >= 2`.
- AC-B2: Modal lists all trees except the active one in `BTDocument.trees` order (post-FB3 user-meaningful order).
- AC-B3: Move on a selection of 3 nodes + 2 edges leaves the source tree without those nodes/edges and the destination tree with them; Ctrl+Z restores both trees in one step.
- AC-B4: Copy on a selection of 3 nodes + 2 edges leaves the source unchanged and adds 3 new-ID nodes + 2 new-ID edges to the destination.
- AC-B5: Move with a boundary edge (selected node → unselected node) drops that edge silently; the dropped count is reflected in the modal summary.
- AC-B6: Move with a Root in the selection to a destination that has a Root → Confirm disabled (V1).
- AC-B7: Move/Copy with a SubTree referencing the destination → Confirm disabled (V2). Test with a multi-tree fixture where Tree A has SubTree referencing Tree B; selecting the SubTree and trying to move/copy to Tree B is blocked.
- AC-B8: After Confirm, `activeTreeId === destinationId` and `selection.nodeIds` contains the transferred/copied node IDs.
- AC-B9: Single Ctrl+Z after Confirm reverts both source and destination to their pre-action state in one step.
- AC-B10: Single Ctrl+Shift+Z replays in one step.
- AC-B11: Esc / backdrop click cancels the modal with no document change.
- AC-B12: If the destination tree's existing Root has no children and Move adds a Root with subtree, the rule is **still blocked** (V1) — we don't try to merge.
- AC-B13: Move that empties the source tree is allowed (the empty tree remains as a valid empty tree, matching the "+ button creates empty tree" precedent from v1.4).

### Pure operation

A new pure function in `src/core/model/operations.ts`:

```ts
export interface MoveCopySelection {
  sourceTree: Treeish;
  destTree: Treeish;
  selectedNodeIds: ReadonlySet<string>;
  mode: 'move' | 'copy';
}

export interface MoveCopyResult {
  sourceTree: Treeish;          // updated source (selected nodes removed for move; same for copy)
  destTree: Treeish;            // updated dest (with transferred / copied nodes + edges)
  transferredNodeIds: string[]; // IDs to select in destination after the action
  droppedEdgeCount: number;     // boundary edges discarded
}

export function moveCopySelection(input: MoveCopySelection): MoveCopyResult;
```

This composes:
- For Move: filter source's nodes/edges by `!selectedNodeIds.has(...)`, append filtered selection to dest. Boundary edges (one endpoint in `selectedNodeIds`, other not) are dropped from BOTH trees.
- For Copy: reuse `duplicateSelection`'s ID-mapping logic (extract a shared helper) to regenerate IDs; source unchanged.

### Store action

```ts
moveCopyToTree: (destinationTreeId: string, mode: 'move' | 'copy') =>
  set((state) => {
    const sourceTree = selectActiveTree(state);
    const destTree = state.document.trees.find(t => t.id === destinationTreeId)!;
    const result = moveCopySelection({
      sourceTree, destTree,
      selectedNodeIds: state.selection.nodeIds,
      mode,
    });
    let document = replaceTree(state.document, result.sourceTree);
    document = replaceTree(document, result.destTree);
    return withSnapshot(state, {
      document,
      activeTreeId: destinationTreeId,
      selection: {
        nodeIds: new Set(result.transferredNodeIds),
        edgeIds: new Set(),
      },
    });
  }),
```

One `withSnapshot` push covers both tree mutations + the active-tab swap + the selection swap. Verified safe per A6.

## Files Modified

| File | Phase | Change |
|------|-------|--------|
| `package.json` | A | Add `@dnd-kit/core`, `@dnd-kit/sortable`. |
| `src/components/tab-bar/TabBar.tsx` | A | Wrap tabs in `<DndContext> + <SortableContext>`; per-tab `useSortable`. Stop event propagation on × and rename input. On reorder end, dispatch reorder action. |
| `src/store/bt-store.ts` | A | New action `reorderTrees(orderedIds: string[])` — replaces `document.trees` order; one `withSnapshot`. |
| `src/store/bt-store.ts` | B | New action `moveCopyToTree(destinationTreeId, mode)` (above). |
| `src/core/model/operations.ts` | B | New pure function `moveCopySelection`. Extract shared ID-mapping helper from `duplicateSelection`. |
| `src/components/toolbar/Toolbar.tsx` | B | Add Move/Copy button + button-disabled logic. |
| `src/components/move-copy/MoveCopyModal.tsx` | B | New: destination dropdown + mode radio + summary + validation messages + Confirm. |
| `src/core/model/operations.ts` | B | Validation helpers: `wouldCreateRootConflict`, `wouldCreateCycle`. |
| `tests/unit/operations-move-copy.test.ts` | B | New: AC-B3–B5 (pure function tests), V1/V2 (validation logic). |
| `tests/unit/bt-store-move-copy.test.ts` | B | New: store action tests covering AC-B8, AC-B9. |
| `tests/component/MoveCopyModal.test.tsx` | B | New: AC-B1–B11 (UI tests). |
| `tests/component/TabBar.test.tsx` | A | New tests: AC-A2, AC-A3, AC-A5, AC-A6. |
| `e2e/cross-tree-move.spec.ts` | B | New: full Move flow + Copy flow + undo. |
| `e2e/tab-reorder.spec.ts` | A | New: drag tab and verify order. |
| `user-guide.md` | A+B | Document new keyboard/UX. |

## Files NOT Modified

- `src/core/serialization/*` — `BTDocument.trees` order is already serialized; reorder needs no schema change.
- `docs/bt-json-format.md` — already documents `trees: BTTreeDef[]` as ordered.
- File format version — no bump needed.

## Boundaries

**Always do:**
- One `withSnapshot` per Move/Copy and per tab reorder. Verify by counting undo stack length before/after in tests.
- Keep `moveCopySelection` in `src/core/` — pure, unit-testable, no React.
- Reuse `duplicateSelection`'s ID-mapping (extract to `regenerateIds(nodes, edges)` helper) instead of re-implementing.
- Validation runs *inside* the modal before Confirm enables; the store action is allowed to assume valid input.

**Ask first:**
- If `@dnd-kit` bundle size growth (~25 KB gz) is unacceptable, fall back to a hand-rolled HTML5 DnD impl.
- If users want a Move/Copy keyboard shortcut (e.g., Ctrl+Shift+M) — defer until requested.
- If destination dropdown should support typeahead for documents with many tabs.

**Never do:**
- Allow Move/Copy to mutate the document outside `withSnapshot` (would break v1.7.1's timeline invariant).
- Allow drag-to-tab as a Move trigger (out of scope; modal is the surface).
- Rebuild edge IDs on Move (only Copy regenerates; Move preserves).
- Validate inside the store action — block at the modal so the action stays simple.
- Allow Move that produces an invalid tree state (orphaned cycles, dangling references); validation rules above must be exhaustive.

## Testing Strategy

| Level | What to test |
|-------|-------------|
| Unit (Vitest) | `moveCopySelection` table tests: move N nodes, copy N nodes, boundary-edge dropping, root conflict detection, cycle detection. ID regeneration fidelity for Copy. |
| Store (Vitest) | `moveCopyToTree` lands one snapshot; `activeTreeId` and `selection` updated correctly; round-trip undo restores byte-identical document. `reorderTrees` lands one snapshot. |
| Component (RTL) | TabBar drag-to-reorder fires correct action; × stops propagation; rename mode disables drag. MoveCopyModal: button enable/disable, mode toggle, validation messages, Confirm action. |
| E2E (Playwright) | Drag a tab to reorder; verify visual + persisted order. Multi-select 3 nodes → Move → destination tab activates → undo restores both. Multi-select 3 nodes → Copy → counts double in source+dest → undo. |

## Edge Cases

- **Move all nodes from a tree:** Source becomes empty (allowed per AC-B13).
- **Move including Root to a Root-less tree:** Allowed; no V1 trigger.
- **Copy with SubTree referencing source itself:** No cycle issue (Copy doesn't change reference targets).
- **Move with SubTree referencing source:** Reference text doesn't change (it's by tree name, not ID); the SubTree now lives in a different tree but still resolves correctly. Verify in test.
- **Reorder during edit:** Drag canceled if user starts editing during DnD operation (DnD library state takes priority; rename mode locked out of drag).
- **Tab reorder via keyboard while a node is selected:** Selection unaffected.
- **Move/Copy with multi-select that includes orphaned nodes (no parent):** Treated as regular nodes; no special edge handling.

## Success Criteria (v1.10)

1. Tabs reorderable via drag, keyboard, or touch — single undo step per reorder.
2. Move/Copy modal exposes destination + mode + summary; validation prevents invalid actions.
3. Move preserves IDs; Copy regenerates IDs (matching v1.5 semantics).
4. Single `withSnapshot` push per action — Ctrl+Z reverts in one step regardless of how many nodes/edges/trees were touched.
5. No regressions in v1.7.1 unified-timeline behavior or v1.8 SubTree changes.
6. Bundle size growth ≤ 30 KB gzipped (`@dnd-kit` only).

## Out of Scope

- Drag-selection-onto-tab as Move trigger (deferred; modal is primary surface).
- Cross-document (cross-file) move/copy.
- Smart-merge of edges to unselected nodes (always dropped per v1.5 precedent).
- Move/Copy keyboard shortcut.
- Visualizing the impact of Move/Copy via a preview before Confirm.
