import { create } from 'zustand';
import type { BTDocument, BTNode, BTTreeDef, NodeKind } from '../core/model/node';
import { createEmptyDocument } from '../core/model/tree';
import {
  addNode,
  connect,
  disconnect,
  moveNode,
  removeNode,
  reorderChildren,
  updateNode,
} from '../core/model/operations';
import {
  clear,
  createRingBuffer,
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

export interface BTStoreState {
  document: BTDocument;
  activeTreeId: string;
  selection: Selection;
  // Per-tree history. Each tree has its own undo/redo stacks so an undo on
  // tab A doesn't reach back through edits made on tab B. Stacks are
  // lazy-initialized on first push (a new tree starts with empty history).
  undoStacks: Record<string, RingBuffer<BTTreeDef>>;
  redoStacks: Record<string, RingBuffer<BTTreeDef>>;
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
  // makes it active. No history snapshot — cross-document mutation, tracked
  // by F19. Caller picks the name; TabBar generates "Tree N".
  addTree: (name: string) => void;
  // Removes a tree from the document. Rejects the main tree (caller's bug)
  // and any unknown id. If the deleted tree was active, switches to main.
  // Tears down per-tree history + viewport via removeTreeStateFor. SubTree
  // nodes that referenced the deleted tree's name keep their stale treeRef
  // — validation R10 (broken references) surfaces them at save time. No
  // history snapshot — same F19 deferral as renameTree/addTree.
  deleteTree: (treeId: string) => void;
  deleteSelection: () => void;
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
  stacks: Record<string, RingBuffer<BTTreeDef>>,
  treeId: string,
): RingBuffer<BTTreeDef> {
  return stacks[treeId] ?? createRingBuffer<BTTreeDef>(HISTORY_CAPACITY);
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
  stacks: Record<string, RingBuffer<BTTreeDef>>,
  treeId: string,
  next: RingBuffer<BTTreeDef>,
): Record<string, RingBuffer<BTTreeDef>> {
  return { ...stacks, [treeId]: next };
}

// Patch the store with a mutated active tree and record the previous tree on
// the active tree's history stack. No-op (returns {}) if the tree reference
// is unchanged.
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
  return {
    document: replaceTree(state.document, nextTree),
    undoStacks: setStack(state.undoStacks, treeId, push(undo, prevTree)),
    redoStacks: setStack(state.redoStacks, treeId, clear(redo)),
    ...extra,
  };
}

const initialDocument = createEmptyDocument();

export const useBTStore = create<BTStoreState>((set) => ({
  document: initialDocument,
  activeTreeId: initialDocument.mainTreeId,
  selection: EMPTY_SELECTION,
  undoStacks: {},
  redoStacks: {},
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
      viewportByTreeId: {},
      validationIssues: null,
      fileName: 'Untitled.json',
    }),
  // Clearing selection on tab switch avoids surfacing nodes that aren't
  // visible on the active canvas. Per-tab undo/redo and viewport restore
  // happen elsewhere — viewport restore is driven by Canvas (it owns the
  // xyflow API); per-tab history is automatic because withHistory and
  // undo/redo always operate on the active tree's stack.
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
  beginGesture: () =>
    set((state) => {
      const treeId = state.activeTreeId;
      const undo = getOrCreateStack(state.undoStacks, treeId);
      const redo = getOrCreateStack(state.redoStacks, treeId);
      return {
        undoStacks: setStack(state.undoStacks, treeId, push(undo, selectActiveTree(state))),
        redoStacks: setStack(state.redoStacks, treeId, clear(redo)),
      };
    }),
  undo: () =>
    set((state) => {
      const treeId = state.activeTreeId;
      const undo = getOrCreateStack(state.undoStacks, treeId);
      const { buf, item } = pop(undo);
      if (!item) return {};
      const current = selectActiveTree(state);
      const redo = getOrCreateStack(state.redoStacks, treeId);
      return {
        document: replaceTree(state.document, item),
        undoStacks: setStack(state.undoStacks, treeId, buf),
        redoStacks: setStack(state.redoStacks, treeId, push(redo, current)),
        selection: EMPTY_SELECTION,
      };
    }),
  redo: () =>
    set((state) => {
      const treeId = state.activeTreeId;
      const redo = getOrCreateStack(state.redoStacks, treeId);
      const { buf, item } = pop(redo);
      if (!item) return {};
      const current = selectActiveTree(state);
      const undo = getOrCreateStack(state.undoStacks, treeId);
      return {
        document: replaceTree(state.document, item),
        redoStacks: setStack(state.redoStacks, treeId, buf),
        undoStacks: setStack(state.undoStacks, treeId, push(undo, current)),
        selection: EMPTY_SELECTION,
      };
    }),
  // Renames a tree and propagates the new name to every SubTree node whose
  // treeRef pointed at the old name. Cross-tree mutation: also updates
  // node.name on those SubTrees so the synced-name invariant holds. No-op if
  // the new name equals the old name. Validates nothing — name uniqueness is
  // enforced at save time by btDocumentSchemaV2 (matches the codebase's
  // "validate, don't block" pattern).
  //
  // Undo limitation: per-tree history (T10) is the wrong shape for this kind
  // of mutation. Tracked as F19 (cross-tree mutation undo) for follow-up; in
  // the meantime, manually rename back to revert.
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
      return { document: { ...state.document, trees } };
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
      return {
        document: { ...state.document, trees: [...state.document.trees, newTree] },
        activeTreeId: treeId,
        selection: EMPTY_SELECTION,
      };
    }),
  deleteTree: (treeId) =>
    set((state) => {
      if (treeId === state.document.mainTreeId) return {};
      if (!state.document.trees.some((t) => t.id === treeId)) return {};
      const nextTrees = state.document.trees.filter((t) => t.id !== treeId);
      const wasActive = state.activeTreeId === treeId;
      return {
        document: { ...state.document, trees: nextTrees },
        activeTreeId: wasActive ? state.document.mainTreeId : state.activeTreeId,
        selection: wasActive ? EMPTY_SELECTION : state.selection,
        ...dropTreeState(state, treeId),
      };
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
