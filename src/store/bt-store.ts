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

export interface BTStoreState {
  document: BTDocument;
  activeTreeId: string;
  selection: Selection;
  // Snapshots are scoped to the active tree (not the whole document). T10 will
  // turn this into a per-tree map keyed by treeId.
  undoStack: RingBuffer<BTTreeDef>;
  redoStack: RingBuffer<BTTreeDef>;
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
  deleteSelection: () => void;
  beginGesture: () => void;
  undo: () => void;
  redo: () => void;
  applyLayout: (positions: Map<string, { x: number; y: number }>) => void;
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

// Patch the store with a mutated active tree and record the previous tree in
// history. No-op (returns {}) if the tree reference is unchanged.
function withHistory(
  state: BTStoreState,
  prevTree: BTTreeDef,
  nextTree: BTTreeDef,
  extra: Partial<BTStoreState> = {},
): Partial<BTStoreState> {
  if (nextTree === prevTree) return {};
  return {
    document: replaceTree(state.document, nextTree),
    undoStack: push(state.undoStack, prevTree),
    redoStack: clear(state.redoStack),
    ...extra,
  };
}

const initialDocument = createEmptyDocument();

export const useBTStore = create<BTStoreState>((set) => ({
  document: initialDocument,
  activeTreeId: initialDocument.mainTreeId,
  selection: EMPTY_SELECTION,
  undoStack: createRingBuffer<BTTreeDef>(HISTORY_CAPACITY),
  redoStack: createRingBuffer<BTTreeDef>(HISTORY_CAPACITY),
  validationIssues: null,
  fileName: 'Untitled.json',
  setDocument: (document) =>
    set((state) => ({
      document,
      activeTreeId: document.mainTreeId,
      selection: EMPTY_SELECTION,
      undoStack: clear(state.undoStack),
      redoStack: clear(state.redoStack),
      validationIssues: null,
      fileName: 'Untitled.json',
    })),
  setActiveTreeId: (treeId) => set({ activeTreeId: treeId }),
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
    set((state) => ({
      undoStack: push(state.undoStack, selectActiveTree(state)),
      redoStack: clear(state.redoStack),
    })),
  undo: () =>
    set((state) => {
      const { buf, item } = pop(state.undoStack);
      if (!item) return {};
      const current = selectActiveTree(state);
      return {
        document: replaceTree(state.document, item),
        undoStack: buf,
        redoStack: push(state.redoStack, current),
        selection: EMPTY_SELECTION,
      };
    }),
  redo: () =>
    set((state) => {
      const { buf, item } = pop(state.redoStack);
      if (!item) return {};
      const current = selectActiveTree(state);
      return {
        document: replaceTree(state.document, item),
        redoStack: buf,
        undoStack: push(state.undoStack, current),
        selection: EMPTY_SELECTION,
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
}));
