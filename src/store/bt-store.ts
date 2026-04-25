import { create } from 'zustand';
import type { BehaviorTree, NodeKind } from '../core/model/node';
import { createEmptyTree } from '../core/model/tree';
import type { BTNode } from '../core/model/node';
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
  tree: BehaviorTree;
  selection: Selection;
  undoStack: RingBuffer<BehaviorTree>;
  redoStack: RingBuffer<BehaviorTree>;
  validationIssues: ValidationIssue[] | null;
  fileName: string;
  setTree: (tree: BehaviorTree) => void;
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

// Patch the store with a new tree and record the previous one in history.
// No-op (returns {}) if the tree reference is unchanged.
function withHistory(
  state: BTStoreState,
  nextTree: BehaviorTree,
  extra: Partial<BTStoreState> = {},
): Partial<BTStoreState> {
  if (nextTree === state.tree) return {};
  return {
    tree: nextTree,
    undoStack: push(state.undoStack, state.tree),
    redoStack: clear(state.redoStack),
    ...extra,
  };
}

export const useBTStore = create<BTStoreState>((set) => ({
  tree: createEmptyTree(),
  selection: EMPTY_SELECTION,
  undoStack: createRingBuffer<BehaviorTree>(HISTORY_CAPACITY),
  redoStack: createRingBuffer<BehaviorTree>(HISTORY_CAPACITY),
  validationIssues: null,
  fileName: 'Untitled.json',
  setTree: (tree) =>
    set((state) => ({
      tree,
      selection: EMPTY_SELECTION,
      undoStack: clear(state.undoStack),
      redoStack: clear(state.redoStack),
      validationIssues: null,
      fileName: 'Untitled.json',
    })),
  setFileName: (name) => set({ fileName: name }),
  setSelection: (selection) => set({ selection }),
  clearSelection: () => set({ selection: EMPTY_SELECTION }),
  selectAll: () =>
    set((state) => ({
      selection: {
        nodeIds: new Set(state.tree.nodes.map((n) => n.id)),
        edgeIds: new Set(state.tree.connections.map((c) => c.id)),
      },
    })),
  runValidation: () => set((state) => ({ validationIssues: validate(state.tree) })),
  closeValidationPanel: () => set({ validationIssues: null }),
  addNode: (kind, position) =>
    set((state) => withHistory(state, addNode(state.tree, kind, position))),
  moveNode: (id, position) =>
    set((state) => ({ tree: moveNode(state.tree, id, position) })),
  // No history snapshot — called inside the same gesture as beginGesture+moveNode.
  reorderChildren: (parentId, orderedChildIds) =>
    set((state) => {
      const nextTree = reorderChildren(state.tree, parentId, orderedChildIds);
      if (nextTree === state.tree) return {};
      return { tree: nextTree };
    }),
  connect: (parentId, childId) =>
    set((state) => withHistory(state, connect(state.tree, parentId, childId))),
  disconnect: (connectionId) =>
    set((state) => {
      const nextTree = disconnect(state.tree, connectionId);
      const nextSelection = {
        nodeIds: state.selection.nodeIds,
        edgeIds: withoutId(state.selection.edgeIds, connectionId),
      };
      return withHistory(state, nextTree, { selection: nextSelection });
    }),
  removeNode: (id) =>
    set((state) => {
      const nextTree = removeNode(state.tree, id);
      if (nextTree === state.tree) return {};
      const removedEdgeIds = new Set(
        state.tree.connections
          .filter((c) => c.parentId === id || c.childId === id)
          .map((c) => c.id),
      );
      const nextSelection: Selection = {
        nodeIds: withoutId(state.selection.nodeIds, id),
        edgeIds: withoutIds(state.selection.edgeIds, removedEdgeIds),
      };
      return withHistory(state, nextTree, { selection: nextSelection });
    }),
  updateNodeKind: (id, kind) =>
    set((state) => withHistory(state, updateNode(state.tree, id, { kind }))),
  // No history snapshot — the property panel wraps a focus session in
  // beginGesture() so a multi-character rename collapses to one undo step.
  updateNodeName: (id, name) =>
    set((state) => {
      const nextTree = updateNode(state.tree, id, { name });
      if (nextTree === state.tree) return {};
      return { tree: nextTree };
    }),
  // Deletes every selected node (except Root) and every selected edge as a single
  // history step. Edges incident to a deleted node are pruned by removeNode, so
  // we only need to disconnect edges that were selected on their own.
  deleteSelection: () =>
    set((state) => {
      if (isEmptySelection(state.selection)) return {};
      let nextTree = state.tree;
      for (const nodeId of state.selection.nodeIds) {
        if (nodeId === state.tree.rootId) continue;
        nextTree = removeNode(nextTree, nodeId);
      }
      const survivingEdgeIds = new Set(nextTree.connections.map((c) => c.id));
      for (const edgeId of state.selection.edgeIds) {
        if (!survivingEdgeIds.has(edgeId)) continue;
        nextTree = disconnect(nextTree, edgeId);
      }
      if (nextTree === state.tree) return { selection: EMPTY_SELECTION };
      return withHistory(state, nextTree, { selection: EMPTY_SELECTION });
    }),
  beginGesture: () =>
    set((state) => ({
      undoStack: push(state.undoStack, state.tree),
      redoStack: clear(state.redoStack),
    })),
  undo: () =>
    set((state) => {
      const { buf, item } = pop(state.undoStack);
      if (!item) return {};
      return {
        tree: item,
        undoStack: buf,
        redoStack: push(state.redoStack, state.tree),
        selection: EMPTY_SELECTION,
      };
    }),
  redo: () =>
    set((state) => {
      const { buf, item } = pop(state.redoStack);
      if (!item) return {};
      return {
        tree: item,
        redoStack: buf,
        undoStack: push(state.undoStack, state.tree),
        selection: EMPTY_SELECTION,
      };
    }),
}));
