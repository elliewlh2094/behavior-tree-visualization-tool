import { create } from 'zustand';
import type { BTDocument, BTNode, BTTreeDef, NodeKind } from '../core/model/node';
import { createEmptyDocument } from '../core/model/tree';
import {
  addNode,
  connect,
  disconnect,
  duplicateSelection,
  moveCopySelection,
  moveNode,
  removeNode,
  reorderChildren,
  updateNode,
} from '../core/model/operations';
import { GRID_SIZE } from '../core/config/grid';
import {
  clear,
  createRingBuffer,
  peek,
  pop,
  push,
  type RingBuffer,
} from '../core/history/ring-buffer';
import { validate } from '../core/validation';
import type { ValidationIssue } from '../core/validation/types';

export type Selection = {
  nodeIds: ReadonlySet<string>;
  edgeIds: ReadonlySet<string>;
};

export const EMPTY_SELECTION: Selection = {
  nodeIds: new Set(),
  edgeIds: new Set(),
};

export function isEmptySelection(s: Selection): boolean {
  return s.nodeIds.size === 0 && s.edgeIds.size === 0;
}

export const HISTORY_CAPACITY = 10;

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

// v1.9: transient image-export mode. UI-only — read by Canvas/BTNode to
// hide overlays during capture. NOT part of DocSnapshot and never pushed to
// history (zustand merges, so setDocument/undo/redo leave it untouched).
export type ExportMode = 'transparent' | 'themed';

// v1.7.1: history is a single chronological timeline of full-document
// snapshots. Every action that mutates the document (per-tree edits AND
// cross-tree mutations like renameTree/addTree/deleteTree) pushes one
// DocSnapshot capturing the doc + activeTreeId BEFORE the action ran.
// Tabs are pure UI projection over this timeline — switching tabs never
// pushes to history and never affects which action gets reverted next.
export type DocSnapshot = {
  document: BTDocument;
  activeTreeId: string;
};

export interface BTStoreState {
  document: BTDocument;
  activeTreeId: string;
  selection: Selection;
  // Single unified history timeline. Pop pushes the current state onto the
  // opposite stack (undo→redo, redo→undo). Bounded by HISTORY_CAPACITY.
  undoStack: RingBuffer<DocSnapshot>;
  redoStack: RingBuffer<DocSnapshot>;
  // Per-tree viewport (xyflow x/y/zoom). Canvas writes here on onMoveEnd
  // and reads on activeTreeId change; missing entries fall back to
  // DEFAULT_VIEWPORT (newly created tabs start centered at the origin).
  // Not part of history — survives undo/redo unchanged.
  viewportByTreeId: Record<string, Viewport>;
  validationIssues: ValidationIssue[] | null;
  fileName: string;
  // v1.9 image export: transient UI flag, not in history. Null when idle.
  exportInProgress: ExportMode | null;
  setExportInProgress: (mode: ExportMode | null) => void;
  // v1.11 FR6 node search. All three fields are transient UI state — plain
  // setters that bypass withSnapshot, so opening search or recomputing matches
  // never touches undo/redo (same pattern as exportInProgress). SearchBox owns
  // the filtering/navigation and writes results here for Canvas → BTNode to read.
  //   searchMatchIds — active-tree node ids whose name matched the query (the
  //     amber "is a match" ring; unordered, O(1) membership for BTNode).
  //   searchCurrentId — the single node the user is currently stepped onto (a
  //     stronger "current match" ring + the one centered). Deviation from the
  //     SPEC-v1.11 FR6 two-field list: a Set can't express "which of N is
  //     current", which the current-match highlight (todo T9) requires.
  searchOpen: boolean;
  searchMatchIds: ReadonlySet<string>;
  searchCurrentId: string | null;
  setSearchOpen: (open: boolean) => void;
  setSearchMatchIds: (ids: ReadonlySet<string>) => void;
  setSearchCurrentId: (id: string | null) => void;
  // v1.11 FR9 unsaved-changes guard. `dirty` is DERIVED, not set per-action:
  // a module-level subscription (bottom of this file) flips it true whenever
  // `document` diverges by reference from `lastSavedDocument`. Both are
  // transient UI state — never in DocSnapshot, never pushed to history.
  // `setDocument`/`markSaved` reset the baseline (clearing dirty); a no-op
  // action returns `{}` and preserves the `document` reference, so dirty is
  // never falsely set. See SPEC-v1.11 FR9 / resolved decision #8.
  dirty: boolean;
  lastSavedDocument: BTDocument;
  // Marks the current document as the saved baseline: clears dirty by pointing
  // lastSavedDocument at the live document. Called by Toolbar after a save.
  markSaved: () => void;
  setDocument: (document: BTDocument) => void;
  setActiveTreeId: (treeId: string) => void;
  setFileName: (name: string) => void;
  setSelection: (selection: Selection) => void;
  clearSelection: () => void;
  selectAll: () => void;
  runValidation: () => void;
  closeValidationPanel: () => void;
  addNode: (kind: NodeKind, position: { x: number; y: number }) => void;
  moveNode: (id: string, position: { x: number; y: number }) => void;
  reorderChildren: (parentId: string, orderedChildIds: string[]) => void;
  connect: (parentId: string, childId: string) => void;
  disconnect: (connectionId: string) => void;
  removeNode: (id: string) => void;
  updateNodeName: (id: string, name: string) => void;
  updateNodeKind: (id: string, kind: BTNode['kind']) => void;
  updateNodeTreeRef: (id: string, treeRef: string) => void;
  renameTree: (treeId: string, newName: string) => void;
  // Appends a new tree (single Root, no connections) to the document and
  // makes it active. Pushes a DocSnapshot onto undoStack via withSnapshot.
  // Caller picks the name; TabBar generates "Tree N".
  addTree: (name: string) => void;
  // Removes a tree from the document. Rejects the main tree (caller's bug)
  // and any unknown id. If the deleted tree was active, switches to main.
  // SubTree nodes that referenced the deleted tree's name keep their stale
  // treeRef — validation R10 (broken references) surfaces them at save
  // time. Pushes a DocSnapshot via withSnapshot; the deleted tree's
  // viewport is intentionally preserved (not dropped) so undo can restore
  // it. Use removeTreeStateFor for explicit teardown.
  deleteTree: (treeId: string) => void;
  // Reorders document.trees to match orderedIds (drag-to-reorder tabs).
  // Defensive: bails (logs + no-op) when orderedIds is not a permutation of
  // the current tree ids. No-op without history when the order is unchanged
  // (element-wise compare — the DnD library hands back a fresh array even on
  // a drop-in-place). Preserves BTTreeDef references. Pushes one DocSnapshot.
  reorderTrees: (orderedIds: string[]) => void;
  deleteSelection: () => void;
  // Duplicates every selected node (Root excluded) and the connections
  // among them. Duplicates land at +(GRID_SIZE, GRID_SIZE), orphaned-in-
  // place. Selection swaps to the duplicated set so the user can
  // immediately drag, delete, or re-duplicate. No-op on empty / edges-
  // only / Root-only selection — no history snapshot.
  duplicateSelection: () => void;
  // Moves or copies the current node selection from the active tree into the
  // tree identified by destinationTreeId. Move preserves ids and strips the
  // selected nodes (+ every touching edge) from the source; Copy regenerates
  // ids and leaves the source intact. Switches the active tab to the
  // destination and selects the transferred nodes. One withSnapshot per call,
  // so a single Ctrl+Z reverts both trees + the tab + the selection. Assumes
  // the caller (MoveCopyModal) has validated; no-op when nothing transfers.
  moveCopyToTree: (destinationTreeId: string, mode: 'move' | 'copy') => void;
  beginGesture: () => void;
  undo: () => void;
  redo: () => void;
  applyLayout: (positions: Map<string, { x: number; y: number }>) => void;
  setViewport: (treeId: string, viewport: Viewport) => void;
  // Removes per-tree viewport for a tree id. History is no longer per-tree
  // (v1.7.1), so this only touches viewportByTreeId. Calling it on the
  // active tree's id is the caller's bug.
  removeTreeStateFor: (treeId: string) => void;
}

/**
 * Selector helper: returns the BTTreeDef the canvas/property panel currently
 * targets. Throws if `activeTreeId` no longer matches a tree (which would
 * indicate a bug elsewhere — keep activeTreeId in sync with `document.trees`).
 */
export function selectActiveTree(state: BTStoreState): BTTreeDef {
  const tree = state.document.trees.find((t) => t.id === state.activeTreeId);
  if (!tree) {
    throw new Error(
      `selectActiveTree: activeTreeId ${state.activeTreeId} is not in document.trees`,
    );
  }
  return tree;
}

/**
 * Selector helper: returns the stored viewport for a tree, or the default
 * (origin, zoom 1) if the tree has never been visited.
 */
export function selectViewport(state: BTStoreState, treeId: string): Viewport {
  return state.viewportByTreeId[treeId] ?? DEFAULT_VIEWPORT;
}

function replaceTree(doc: BTDocument, nextTree: BTTreeDef): BTDocument {
  return {
    ...doc,
    trees: doc.trees.map((t) => (t.id === nextTree.id ? nextTree : t)),
  };
}

function withoutId(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  if (!set.has(id)) return set;
  const next = new Set(set);
  next.delete(id);
  return next;
}

function withoutIds(
  set: ReadonlySet<string>,
  ids: ReadonlySet<string>,
): ReadonlySet<string> {
  if (set.size === 0 || ids.size === 0) return set;
  let changed = false;
  const next = new Set(set);
  for (const id of ids) {
    if (next.delete(id)) changed = true;
  }
  return changed ? next : set;
}

// Drops per-tree viewport for a tree id. Used by removeTreeStateFor.
// History is no longer keyed by treeId in v1.7.1, so nothing else to drop.
function dropTreeState(
  state: BTStoreState,
  treeId: string,
): Pick<BTStoreState, 'viewportByTreeId'> {
  const { [treeId]: _v, ...viewportByTreeId } = state.viewportByTreeId;
  void _v;
  return { viewportByTreeId };
}

// Push the current document + activeTreeId onto undoStack and clear
// redoStack (any forward branch is invalidated by a new push). The patch
// applies on top of the snapshot push, so the caller is responsible for
// computing the next document state. Identical-state short-circuits stay
// in callers — they `return {}` without invoking withSnapshot.
function withSnapshot(
  state: BTStoreState,
  patch: Partial<BTStoreState>,
): Partial<BTStoreState> {
  return {
    undoStack: push(state.undoStack, {
      document: state.document,
      activeTreeId: state.activeTreeId,
    }),
    redoStack: clear(state.redoStack),
    ...patch,
  };
}

const initialDocument = createEmptyDocument();

export const useBTStore = create<BTStoreState>((set) => ({
  document: initialDocument,
  activeTreeId: initialDocument.mainTreeId,
  selection: EMPTY_SELECTION,
  undoStack: createRingBuffer<DocSnapshot>(HISTORY_CAPACITY),
  redoStack: createRingBuffer<DocSnapshot>(HISTORY_CAPACITY),
  viewportByTreeId: {},
  validationIssues: null,
  fileName: 'Untitled.json',
  exportInProgress: null,
  searchOpen: false,
  searchMatchIds: new Set(),
  searchCurrentId: null,
  dirty: false,
  lastSavedDocument: initialDocument,
  // No history snapshot — pure UI state.
  setExportInProgress: (mode) => set({ exportInProgress: mode }),
  // No history snapshot — transient search UI state. Closing search clears the
  // match set + current id so stale highlights never linger on the canvas.
  setSearchOpen: (open) =>
    set(
      open
        ? { searchOpen: true }
        : { searchOpen: false, searchMatchIds: new Set(), searchCurrentId: null },
    ),
  setSearchMatchIds: (ids) => set({ searchMatchIds: ids }),
  setSearchCurrentId: (id) => set({ searchCurrentId: id }),
  // Re-baselines dirty onto the live document. The subscription will then
  // compute dirty=false on its next run (document === lastSavedDocument).
  markSaved: () =>
    set((state) => ({ dirty: false, lastSavedDocument: state.document })),
  setDocument: (document) =>
    set({
      document,
      activeTreeId: document.mainTreeId,
      selection: EMPTY_SELECTION,
      undoStack: createRingBuffer<DocSnapshot>(HISTORY_CAPACITY),
      redoStack: createRingBuffer<DocSnapshot>(HISTORY_CAPACITY),
      viewportByTreeId: {},
      validationIssues: null,
      fileName: 'Untitled.json',
      // Opening/loading a document is the new clean baseline.
      dirty: false,
      lastSavedDocument: document,
    }),
  // Pure UI state: no history snapshot. Clearing selection on tab switch
  // avoids surfacing nodes that aren't on the active canvas. Viewport
  // restore is driven by Canvas (owns xyflow API). Tab switching never
  // affects history — history is a single document-level timeline.
  setActiveTreeId: (treeId) =>
    set({ activeTreeId: treeId, selection: EMPTY_SELECTION }),
  setFileName: (name) => set({ fileName: name }),
  setSelection: (selection) => set({ selection }),
  clearSelection: () => set({ selection: EMPTY_SELECTION }),
  selectAll: () =>
    set((state) => {
      const tree = selectActiveTree(state);
      return {
        selection: {
          nodeIds: new Set(tree.nodes.map((n) => n.id)),
          edgeIds: new Set(tree.connections.map((c) => c.id)),
        },
      };
    }),
  runValidation: () =>
    set((state) => ({ validationIssues: validate(state.document) })),
  closeValidationPanel: () => set({ validationIssues: null }),
  addNode: (kind, position) =>
    set((state) => {
      const tree = selectActiveTree(state);
      const nextTree = addNode(tree, kind, position);
      if (nextTree === tree) return {};
      return withSnapshot(state, {
        document: replaceTree(state.document, nextTree),
      });
    }),
  moveNode: (id, position) =>
    set((state) => {
      const tree = selectActiveTree(state);
      const nextTree = moveNode(tree, id, position);
      if (nextTree === tree) return {};
      return { document: replaceTree(state.document, nextTree) };
    }),
  // No history snapshot — called inside the same gesture as beginGesture+moveNode.
  reorderChildren: (parentId, orderedChildIds) =>
    set((state) => {
      const tree = selectActiveTree(state);
      const nextTree = reorderChildren(tree, parentId, orderedChildIds);
      if (nextTree === tree) return {};
      return { document: replaceTree(state.document, nextTree) };
    }),
  connect: (parentId, childId) =>
    set((state) => {
      const tree = selectActiveTree(state);
      const nextTree = connect(tree, parentId, childId);
      if (nextTree === tree) return {};
      return withSnapshot(state, {
        document: replaceTree(state.document, nextTree),
      });
    }),
  disconnect: (connectionId) =>
    set((state) => {
      const tree = selectActiveTree(state);
      const nextTree = disconnect(tree, connectionId);
      if (nextTree === tree) return {};
      const nextSelection = {
        nodeIds: state.selection.nodeIds,
        edgeIds: withoutId(state.selection.edgeIds, connectionId),
      };
      return withSnapshot(state, {
        document: replaceTree(state.document, nextTree),
        selection: nextSelection,
      });
    }),
  removeNode: (id) =>
    set((state) => {
      const tree = selectActiveTree(state);
      const nextTree = removeNode(tree, id);
      if (nextTree === tree) return {};
      const removedEdgeIds = new Set(
        tree.connections
          .filter((c) => c.parentId === id || c.childId === id)
          .map((c) => c.id),
      );
      const nextSelection: Selection = {
        nodeIds: withoutId(state.selection.nodeIds, id),
        edgeIds: withoutIds(state.selection.edgeIds, removedEdgeIds),
      };
      return withSnapshot(state, {
        document: replaceTree(state.document, nextTree),
        selection: nextSelection,
      });
    }),
  updateNodeKind: (id, kind) =>
    set((state) => {
      const tree = selectActiveTree(state);
      const nextTree = updateNode(tree, id, { kind });
      if (nextTree === tree) return {};
      return withSnapshot(state, {
        document: replaceTree(state.document, nextTree),
      });
    }),
  // Picking a treeRef also syncs the node's name to the referenced tree's
  // name. The SubTree node's identity *is* the tree it expands to, so we
  // keep the two fields in lockstep at every mutation site (here on pick;
  // renameTree below on tree-rename). Old data with name != treeRef from
  // before this rule landed displays as-is until the user touches the
  // dropdown or name field — no silent rewrite at load time.
  updateNodeTreeRef: (id, treeRef) =>
    set((state) => {
      const tree = selectActiveTree(state);
      const referenced = state.document.trees.find((t) => t.name === treeRef);
      const patch = referenced
        ? { treeRef, name: referenced.name }
        : { treeRef };
      const nextTree = updateNode(tree, id, patch);
      if (nextTree === tree) return {};
      return withSnapshot(state, {
        document: replaceTree(state.document, nextTree),
      });
    }),
  // No history snapshot — the property panel wraps a focus session in
  // beginGesture() so a multi-character rename collapses to one undo step.
  updateNodeName: (id, name) =>
    set((state) => {
      const tree = selectActiveTree(state);
      const nextTree = updateNode(tree, id, { name });
      if (nextTree === tree) return {};
      return { document: replaceTree(state.document, nextTree) };
    }),
  // Deletes every selected node (except Root) and every selected edge as a single
  // history step. Edges incident to a deleted node are pruned by removeNode, so
  // we only need to disconnect edges that were selected on their own.
  deleteSelection: () =>
    set((state) => {
      if (isEmptySelection(state.selection)) return {};
      const tree = selectActiveTree(state);
      let nextTree: BTTreeDef = tree;
      for (const nodeId of state.selection.nodeIds) {
        if (nodeId === tree.rootId) continue;
        nextTree = removeNode(nextTree, nodeId);
      }
      const survivingEdgeIds = new Set(nextTree.connections.map((c) => c.id));
      for (const edgeId of state.selection.edgeIds) {
        if (!survivingEdgeIds.has(edgeId)) continue;
        nextTree = disconnect(nextTree, edgeId);
      }
      if (nextTree === tree) return { selection: EMPTY_SELECTION };
      return withSnapshot(state, {
        document: replaceTree(state.document, nextTree),
        selection: EMPTY_SELECTION,
      });
    }),
  duplicateSelection: () =>
    set((state) => {
      const tree = selectActiveTree(state);
      const result = duplicateSelection(tree, state.selection.nodeIds, {
        offsetX: GRID_SIZE,
        offsetY: GRID_SIZE,
      });
      // Same-reference return = nothing duplicated (empty / edges-only /
      // Root-only selection). Skip the snapshot push so an edges-only
      // selection isn't cleared from under the user by a no-op duplicate.
      if (result.tree === tree) return {};
      return withSnapshot(state, {
        document: replaceTree(state.document, result.tree),
        selection: { nodeIds: result.newNodeIds, edgeIds: result.newEdgeIds },
      });
    }),
  moveCopyToTree: (destinationTreeId, mode) =>
    set((state) => {
      // Defensive: the modal lists only non-active trees, but guard against a
      // self-target or unknown id rather than corrupting the document.
      if (destinationTreeId === state.activeTreeId) return {};
      const sourceTree = selectActiveTree(state);
      const destTree = state.document.trees.find((t) => t.id === destinationTreeId);
      if (!destTree) return {};

      const result = moveCopySelection({
        sourceTree,
        destTree,
        selectedNodeIds: state.selection.nodeIds,
        mode,
      });
      // Nothing resolved after filtering (empty / edges-only selection) — skip
      // the snapshot so an inert call doesn't pollute history or clear the tab.
      if (result.transferredNodeIds.length === 0) return {};

      // Two replaceTree calls fold both the (possibly unchanged) source and the
      // destination into one new document, captured by a single withSnapshot.
      const document = replaceTree(
        replaceTree(state.document, result.sourceTree),
        result.destTree,
      );
      return withSnapshot(state, {
        document,
        activeTreeId: destinationTreeId,
        selection: { nodeIds: new Set(result.transferredNodeIds), edgeIds: new Set() },
      });
    }),
  // Pushes a snapshot of the current state without changing it. Used by
  // Canvas (drag start) and PropertyPanel (name-edit start) to coalesce
  // a sequence of in-gesture updates into a single undo step.
  beginGesture: () => set((state) => withSnapshot(state, {})),
  // Pop the most recent snapshot from undoStack, restore document, and
  // push the pre-restore state onto redoStack. activeTreeId is preserved
  // unless the currently-displayed tree no longer exists in the restored
  // document — in that case (e.g., undoing addTree from the new tab) it
  // falls back to the snapshot's activeTreeId. Selection clears.
  undo: () =>
    set((state) => {
      const top = peek(state.undoStack);
      if (!top) return {};
      const { buf } = pop(state.undoStack);
      const stillExists = top.document.trees.some(
        (t) => t.id === state.activeTreeId,
      );
      return {
        document: top.document,
        activeTreeId: stillExists ? state.activeTreeId : top.activeTreeId,
        undoStack: buf,
        redoStack: push(state.redoStack, {
          document: state.document,
          activeTreeId: state.activeTreeId,
        }),
        selection: EMPTY_SELECTION,
      };
    }),
  // Redo is symmetric to undo: pop redoStack, restore, push pre-restore
  // state onto undoStack. Same active-tab fallback rule.
  redo: () =>
    set((state) => {
      const top = peek(state.redoStack);
      if (!top) return {};
      const { buf } = pop(state.redoStack);
      const stillExists = top.document.trees.some(
        (t) => t.id === state.activeTreeId,
      );
      return {
        document: top.document,
        activeTreeId: stillExists ? state.activeTreeId : top.activeTreeId,
        redoStack: buf,
        undoStack: push(state.undoStack, {
          document: state.document,
          activeTreeId: state.activeTreeId,
        }),
        selection: EMPTY_SELECTION,
      };
    }),
  // Renames a tree and propagates the new name to every SubTree node whose
  // treeRef pointed at the old name. Cross-tree mutation: also updates
  // node.name on those SubTrees so the synced-name invariant holds. No-op if
  // the new name equals the old name. Validates nothing — name uniqueness is
  // enforced at save time by btDocumentSchemaV2 (matches the codebase's
  // "validate, don't block" pattern). Pushes a DocSnapshot via withSnapshot.
  renameTree: (treeId, newName) =>
    set((state) => {
      const tree = state.document.trees.find((t) => t.id === treeId);
      if (!tree || tree.name === newName) return {};
      const oldName = tree.name;
      const trees = state.document.trees.map((t) => {
        const renamedTree = t.id === treeId ? { ...t, name: newName } : t;
        let touchedAnyNode = false;
        const nextNodes = renamedTree.nodes.map((n) => {
          if (n.kind !== 'SubTree' || n.treeRef !== oldName) return n;
          touchedAnyNode = true;
          return { ...n, treeRef: newName, name: newName };
        });
        return touchedAnyNode ? { ...renamedTree, nodes: nextNodes } : renamedTree;
      });
      return withSnapshot(state, {
        document: { ...state.document, trees },
      });
    }),
  addTree: (name) =>
    set((state) => {
      const treeId = crypto.randomUUID();
      const rootId = crypto.randomUUID();
      const root: BTNode = {
        id: rootId,
        kind: 'Root',
        name: 'Root',
        position: { x: 0, y: 0 },
        properties: {},
      };
      const newTree: BTTreeDef = {
        id: treeId,
        name,
        rootId,
        nodes: [root],
        connections: [],
      };
      return withSnapshot(state, {
        document: { ...state.document, trees: [...state.document.trees, newTree] },
        activeTreeId: treeId,
        selection: EMPTY_SELECTION,
      });
    }),
  deleteTree: (treeId) =>
    set((state) => {
      if (treeId === state.document.mainTreeId) return {};
      if (!state.document.trees.some((t) => t.id === treeId)) return {};
      const nextTrees = state.document.trees.filter((t) => t.id !== treeId);
      const wasActive = state.activeTreeId === treeId;
      // Per-tree viewport for the deleted tree is intentionally NOT
      // dropped here so undo can restore it intact. Use removeTreeStateFor
      // for explicit teardown when undoability is not wanted.
      return withSnapshot(state, {
        document: { ...state.document, trees: nextTrees },
        activeTreeId: wasActive ? state.document.mainTreeId : state.activeTreeId,
        selection: wasActive ? EMPTY_SELECTION : state.selection,
      });
    }),
  reorderTrees: (orderedIds) =>
    set((state) => {
      const current = state.document.trees;
      const byId = new Map(current.map((t) => [t.id, t]));
      if (
        orderedIds.length !== current.length ||
        !orderedIds.every((id) => byId.has(id))
      ) {
        console.warn(
          'reorderTrees: orderedIds is not a permutation of current tree ids; ignoring',
          { orderedIds, current: current.map((t) => t.id) },
        );
        return {};
      }
      if (orderedIds.every((id, i) => id === current[i]!.id)) return {};
      const nextTrees = orderedIds.map((id) => byId.get(id)!);
      return withSnapshot(state, {
        document: { ...state.document, trees: nextTrees },
      });
    }),
  applyLayout: (positions) =>
    set((state) => {
      const tree = selectActiveTree(state);
      let changed = false;
      const nextNodes = tree.nodes.map((n) => {
        const p = positions.get(n.id);
        if (!p || (p.x === n.position.x && p.y === n.position.y)) return n;
        changed = true;
        return { ...n, position: p };
      });
      if (!changed) return {};
      return withSnapshot(state, {
        document: replaceTree(state.document, { ...tree, nodes: nextNodes }),
      });
    }),
  setViewport: (treeId, viewport) =>
    set((state) => ({
      viewportByTreeId: { ...state.viewportByTreeId, [treeId]: viewport },
    })),
  removeTreeStateFor: (treeId) =>
    set((state) => dropTreeState(state, treeId)),
}));

// FR9 dirty tracking. A single store-level subscription derives `dirty` from
// reference equality: every mutating action builds a fresh `document` object
// while a no-op action returns `{}` (preserving the reference), so the compare
// never false-positives. setDocument/markSaved re-point lastSavedDocument at
// the live document, which makes this compute dirty=false. The guard
// (`shouldBeDirty !== state.dirty`) means the dirty write doesn't re-enter:
// the nested setState fires the subscriber again, but the value now matches and
// it stops. Store-level (not a hook) so dirty stays correct whether or not any
// component is mounted — see SPEC-v1.11 FR9 / resolved decision #8.
useBTStore.subscribe((state) => {
  const shouldBeDirty = state.document !== state.lastSavedDocument;
  if (shouldBeDirty !== state.dirty) {
    useBTStore.setState({ dirty: shouldBeDirty });
  }
});
