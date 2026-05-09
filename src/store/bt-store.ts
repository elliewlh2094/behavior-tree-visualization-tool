import { create } from 'zustand';
import type { BTDocument, BTNode, BTTreeDef, NodeKind } from '../core/model/node';
import { createEmptyDocument } from '../core/model/tree';
import {
  addNode,
  connect,
  disconnect,
  duplicateSelection,
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

// Snapshots are tagged with a monotonically-increasing seq so that v1.7's
// merged undo/redo (per-tree + global doc-level fallback stack) can pick the
// most-recent push by seq comparison. The seq lives on every push site
// (withHistory, beginGesture, undo→redo, redo→undo) regardless of which
// stack it lands on.
export type TreeSnapshot = { seq: number; tree: BTTreeDef };

// Doc-level snapshot used by cross-tree mutations (renameTree, addTree,
// deleteTree). The active tree id is captured at push time so an undo can
// also restore which tab was active when the action was made.
export type GlobalSnapshot = {
  seq: number;
  document: BTDocument;
  activeTreeId: string;
};

export interface BTStoreState {
  document: BTDocument;
  activeTreeId: string;
  selection: Selection;
  // Per-tree history. Each tree has its own undo/redo stacks so an undo on
  // tab A doesn't reach back through edits made on tab B. Stacks are
  // lazy-initialized on first push (a new tree starts with empty history).
  undoStacks: Record<string, RingBuffer<TreeSnapshot>>;
  redoStacks: Record<string, RingBuffer<TreeSnapshot>>;
  // Doc-level fallback stacks for cross-tree mutations (renameTree, addTree,
  // deleteTree) that can't be expressed as a single-tree snapshot. T3 wires
  // undo/redo to merge these with per-tree stacks by max-seq.
  globalUndoStack: RingBuffer<GlobalSnapshot>;
  globalRedoStack: RingBuffer<GlobalSnapshot>;
  // Monotonic counter incremented on every history push. v1.7 uses it to
  // order per-tree pushes against doc-level pushes for cross-tree undo.
  historySeq: number;
  // Per-tree viewport (xyflow x/y/zoom). Canvas writes here on onMoveEnd
  // and reads on activeTreeId change; missing entries fall back to
  // DEFAULT_VIEWPORT (newly created tabs start centered at the origin).
  viewportByTreeId: Record<string, Viewport>;
  validationIssues: ValidationIssue[] | null;
  fileName: string;
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
  // makes it active. Pushes a doc-level snapshot to globalUndoStack via
  // withCrossTreeHistory (v1.7). Caller picks the name; TabBar generates
  // "Tree N".
  addTree: (name: string) => void;
  // Removes a tree from the document. Rejects the main tree (caller's bug)
  // and any unknown id. If the deleted tree was active, switches to main.
  // SubTree nodes that referenced the deleted tree's name keep their stale
  // treeRef — validation R10 (broken references) surfaces them at save
  // time. Pushes a doc-level snapshot to globalUndoStack via
  // withCrossTreeHistory (v1.7); per-tree history + viewport for the
  // deleted tree are intentionally preserved (not dropped) so undo can
  // restore them. Use removeTreeStateFor for explicit teardown.
  deleteTree: (treeId: string) => void;
  deleteSelection: () => void;
  // Duplicates every selected node (Root excluded) and the connections
  // among them. Duplicates land at +(GRID_SIZE, GRID_SIZE), orphaned-in-
  // place. Selection swaps to the duplicated set so the user can
  // immediately drag, delete, or re-duplicate. No-op on empty / edges-
  // only / Root-only selection — no history snapshot.
  duplicateSelection: () => void;
  beginGesture: () => void;
  undo: () => void;
  redo: () => void;
  applyLayout: (positions: Map<string, { x: number; y: number }>) => void;
  setViewport: (treeId: string, viewport: Viewport) => void;
  // Removes per-tree state (history + viewport) for a tree id. Wired for T11
  // tree-delete; calling it on the active tree's id is the caller's bug.
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

function getOrCreateStack(
  stacks: Record<string, RingBuffer<TreeSnapshot>>,
  treeId: string,
): RingBuffer<TreeSnapshot> {
  return stacks[treeId] ?? createRingBuffer<TreeSnapshot>(HISTORY_CAPACITY);
}

// Drops per-tree state (history + viewport) for a tree id. Used by both
// deleteTree (atomic with the doc/activeTreeId update) and removeTreeStateFor.
function dropTreeState(
  state: BTStoreState,
  treeId: string,
): Pick<BTStoreState, 'undoStacks' | 'redoStacks' | 'viewportByTreeId'> {
  const { [treeId]: _u, ...undoStacks } = state.undoStacks;
  const { [treeId]: _r, ...redoStacks } = state.redoStacks;
  const { [treeId]: _v, ...viewportByTreeId } = state.viewportByTreeId;
  void _u;
  void _r;
  void _v;
  return { undoStacks, redoStacks, viewportByTreeId };
}

function setStack(
  stacks: Record<string, RingBuffer<TreeSnapshot>>,
  treeId: string,
  next: RingBuffer<TreeSnapshot>,
): Record<string, RingBuffer<TreeSnapshot>> {
  return { ...stacks, [treeId]: next };
}

// Clears every per-tree redo stack. Used by withCrossTreeHistory when a
// doc-level push lands — every per-tree forward branch is now stale (the
// new doc-level mutation invalidates them). Returns the same record by
// reference if every stack is already empty (avoids gratuitous churn).
function clearAllRedoStacks(
  redoStacks: Record<string, RingBuffer<TreeSnapshot>>,
): Record<string, RingBuffer<TreeSnapshot>> {
  let changed = false;
  const next: Record<string, RingBuffer<TreeSnapshot>> = {};
  for (const [treeId, stack] of Object.entries(redoStacks)) {
    const cleared = clear(stack);
    if (cleared !== stack) changed = true;
    next[treeId] = cleared;
  }
  return changed ? next : redoStacks;
}

// Patch the store with a mutated active tree and record the previous tree on
// the active tree's history stack. No-op (returns {}) if the tree reference
// is unchanged. Also clears globalRedoStack so a per-tree push invalidates
// any pending cross-tree redo (decision 5 in tasks/v1.7-todo.md).
function withHistory(
  state: BTStoreState,
  prevTree: BTTreeDef,
  nextTree: BTTreeDef,
  extra: Partial<BTStoreState> = {},
): Partial<BTStoreState> {
  if (nextTree === prevTree) return {};
  const treeId = state.activeTreeId;
  const undo = getOrCreateStack(state.undoStacks, treeId);
  const redo = getOrCreateStack(state.redoStacks, treeId);
  const nextSeq = state.historySeq + 1;
  return {
    document: replaceTree(state.document, nextTree),
    undoStacks: setStack(state.undoStacks, treeId, push(undo, { seq: nextSeq, tree: prevTree })),
    redoStacks: setStack(state.redoStacks, treeId, clear(redo)),
    globalRedoStack: clear(state.globalRedoStack),
    historySeq: nextSeq,
    ...extra,
  };
}

// Patch the store with a doc-level mutation and snapshot the previous
// document + activeTreeId onto globalUndoStack. Clears globalRedoStack
// AND every per-tree redo stack (decision 5: any new push invalidates the
// entire forward branch, including pending per-tree redoes). Used by
// renameTree, addTree, deleteTree.
function withCrossTreeHistory(
  state: BTStoreState,
  prevDocument: BTDocument,
  prevActiveTreeId: string,
  patch: Partial<BTStoreState>,
): Partial<BTStoreState> {
  const nextSeq = state.historySeq + 1;
  return {
    globalUndoStack: push(state.globalUndoStack, {
      seq: nextSeq,
      document: prevDocument,
      activeTreeId: prevActiveTreeId,
    }),
    globalRedoStack: clear(state.globalRedoStack),
    redoStacks: clearAllRedoStacks(state.redoStacks),
    historySeq: nextSeq,
    ...patch,
  };
}

const initialDocument = createEmptyDocument();

export const useBTStore = create<BTStoreState>((set) => ({
  document: initialDocument,
  activeTreeId: initialDocument.mainTreeId,
  selection: EMPTY_SELECTION,
  undoStacks: {},
  redoStacks: {},
  globalUndoStack: createRingBuffer<GlobalSnapshot>(HISTORY_CAPACITY),
  globalRedoStack: createRingBuffer<GlobalSnapshot>(HISTORY_CAPACITY),
  historySeq: 0,
  viewportByTreeId: {},
  validationIssues: null,
  fileName: 'Untitled.json',
  setDocument: (document) =>
    set({
      document,
      activeTreeId: document.mainTreeId,
      selection: EMPTY_SELECTION,
      undoStacks: {},
      redoStacks: {},
      globalUndoStack: createRingBuffer<GlobalSnapshot>(HISTORY_CAPACITY),
      globalRedoStack: createRingBuffer<GlobalSnapshot>(HISTORY_CAPACITY),
      historySeq: 0,
      viewportByTreeId: {},
      validationIssues: null,
      fileName: 'Untitled.json',
    }),
  // Pure UI state: no history snapshot. Clearing selection on tab switch
  // avoids surfacing nodes that aren't on the active canvas. Viewport
  // restore is driven by Canvas (owns xyflow API). Per-tab history is
  // automatic because withHistory operates on the active tree's stack;
  // cross-tree mutations (renameTree/addTree/deleteTree) push onto
  // globalUndoStack instead and are merged into undo/redo by max-seq.
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
      return withHistory(state, tree, addNode(tree, kind, position));
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
      return withHistory(state, tree, connect(tree, parentId, childId));
    }),
  disconnect: (connectionId) =>
    set((state) => {
      const tree = selectActiveTree(state);
      const nextTree = disconnect(tree, connectionId);
      const nextSelection = {
        nodeIds: state.selection.nodeIds,
        edgeIds: withoutId(state.selection.edgeIds, connectionId),
      };
      return withHistory(state, tree, nextTree, { selection: nextSelection });
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
      return withHistory(state, tree, nextTree, { selection: nextSelection });
    }),
  updateNodeKind: (id, kind) =>
    set((state) => {
      const tree = selectActiveTree(state);
      return withHistory(state, tree, updateNode(tree, id, { kind }));
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
      return withHistory(state, tree, updateNode(tree, id, patch));
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
      return withHistory(state, tree, nextTree, { selection: EMPTY_SELECTION });
    }),
  duplicateSelection: () =>
    set((state) => {
      const tree = selectActiveTree(state);
      const result = duplicateSelection(tree, state.selection.nodeIds, {
        offsetX: GRID_SIZE,
        offsetY: GRID_SIZE,
      });
      // Same-reference return = nothing duplicated (empty / edges-only /
      // Root-only selection). withHistory also short-circuits on identity,
      // but checking here keeps selection untouched — a no-op duplicate
      // shouldn't clear an edges-only selection out from under the user.
      if (result.tree === tree) return {};
      return withHistory(state, tree, result.tree, {
        selection: { nodeIds: result.newNodeIds, edgeIds: result.newEdgeIds },
      });
    }),
  beginGesture: () =>
    set((state) => {
      const treeId = state.activeTreeId;
      const undo = getOrCreateStack(state.undoStacks, treeId);
      const redo = getOrCreateStack(state.redoStacks, treeId);
      const nextSeq = state.historySeq + 1;
      return {
        undoStacks: setStack(state.undoStacks, treeId, push(undo, { seq: nextSeq, tree: selectActiveTree(state) })),
        redoStacks: setStack(state.redoStacks, treeId, clear(redo)),
        globalRedoStack: clear(state.globalRedoStack),
        historySeq: nextSeq,
      };
    }),
  // Undo merges per-tree and global stacks: pop whichever top has the higher
  // seq. When global wins, restore the prior document + activeTreeId; when
  // local wins, restore the active tree (current behavior). Either way, the
  // popped state's "future" version is re-tagged with a fresh seq before
  // landing on the opposite redo stack so chronological order survives
  // undo→redo→undo round-trips. (v1.7)
  undo: () =>
    set((state) => {
      const treeId = state.activeTreeId;
      const localStack = getOrCreateStack(state.undoStacks, treeId);
      const localTop = peek(localStack);
      const globalTop = peek(state.globalUndoStack);

      if (!localTop && !globalTop) return {};

      const useGlobal =
        globalTop !== undefined && (!localTop || globalTop.seq > localTop.seq);
      const nextSeq = state.historySeq + 1;

      if (useGlobal) {
        const { buf } = pop(state.globalUndoStack);
        return {
          document: globalTop!.document,
          activeTreeId: globalTop!.activeTreeId,
          globalUndoStack: buf,
          globalRedoStack: push(state.globalRedoStack, {
            seq: nextSeq,
            document: state.document,
            activeTreeId: state.activeTreeId,
          }),
          historySeq: nextSeq,
          selection: EMPTY_SELECTION,
        };
      }

      const { buf } = pop(localStack);
      const current = selectActiveTree(state);
      const redo = getOrCreateStack(state.redoStacks, treeId);
      return {
        document: replaceTree(state.document, localTop!.tree),
        undoStacks: setStack(state.undoStacks, treeId, buf),
        redoStacks: setStack(state.redoStacks, treeId, push(redo, { seq: nextSeq, tree: current })),
        historySeq: nextSeq,
        selection: EMPTY_SELECTION,
      };
    }),
  // Redo is symmetric to undo: pop max-seq across per-tree redo + global
  // redo, restore, push current state onto the corresponding undo stack
  // tagged with a fresh seq.
  redo: () =>
    set((state) => {
      const treeId = state.activeTreeId;
      const localStack = getOrCreateStack(state.redoStacks, treeId);
      const localTop = peek(localStack);
      const globalTop = peek(state.globalRedoStack);

      if (!localTop && !globalTop) return {};

      const useGlobal =
        globalTop !== undefined && (!localTop || globalTop.seq > localTop.seq);
      const nextSeq = state.historySeq + 1;

      if (useGlobal) {
        const { buf } = pop(state.globalRedoStack);
        return {
          document: globalTop!.document,
          activeTreeId: globalTop!.activeTreeId,
          globalRedoStack: buf,
          globalUndoStack: push(state.globalUndoStack, {
            seq: nextSeq,
            document: state.document,
            activeTreeId: state.activeTreeId,
          }),
          historySeq: nextSeq,
          selection: EMPTY_SELECTION,
        };
      }

      const { buf } = pop(localStack);
      const current = selectActiveTree(state);
      const undo = getOrCreateStack(state.undoStacks, treeId);
      return {
        document: replaceTree(state.document, localTop!.tree),
        redoStacks: setStack(state.redoStacks, treeId, buf),
        undoStacks: setStack(state.undoStacks, treeId, push(undo, { seq: nextSeq, tree: current })),
        historySeq: nextSeq,
        selection: EMPTY_SELECTION,
      };
    }),
  // Renames a tree and propagates the new name to every SubTree node whose
  // treeRef pointed at the old name. Cross-tree mutation: also updates
  // node.name on those SubTrees so the synced-name invariant holds. No-op if
  // the new name equals the old name. Validates nothing — name uniqueness is
  // enforced at save time by btDocumentSchemaV2 (matches the codebase's
  // "validate, don't block" pattern). Pushes a doc-level snapshot to
  // globalUndoStack via withCrossTreeHistory (v1.7).
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
      return withCrossTreeHistory(state, state.document, state.activeTreeId, {
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
      return withCrossTreeHistory(state, state.document, state.activeTreeId, {
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
      // Per v1.7 decision 8: per-tree state for the deleted tree is
      // intentionally NOT dropped here so undo can restore it intact. Use
      // removeTreeStateFor for explicit teardown when undoability is not
      // wanted.
      return withCrossTreeHistory(state, state.document, state.activeTreeId, {
        document: { ...state.document, trees: nextTrees },
        activeTreeId: wasActive ? state.document.mainTreeId : state.activeTreeId,
        selection: wasActive ? EMPTY_SELECTION : state.selection,
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
      return withHistory(state, tree, { ...tree, nodes: nextNodes });
    }),
  setViewport: (treeId, viewport) =>
    set((state) => ({
      viewportByTreeId: { ...state.viewportByTreeId, [treeId]: viewport },
    })),
  removeTreeStateFor: (treeId) =>
    set((state) => dropTreeState(state, treeId)),
}));
