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
  updateNode,
} from '../core/model/operations';
import {
  clear,
  createRingBuffer,
  pop,
  push,
  type RingBuffer,
} from '../core/history/ring-buffer';

export type Selection = { type: 'node' | 'edge'; id: string } | null;

export const HISTORY_CAPACITY = 5;

export interface BTStoreState {
  tree: BehaviorTree;
  selection: Selection;
  undoStack: RingBuffer<BehaviorTree>;
  redoStack: RingBuffer<BehaviorTree>;
  setTree: (tree: BehaviorTree) => void;
  setSelection: (selection: Selection) => void;
  clearSelection: () => void;
  addNode: (kind: NodeKind, position: { x: number; y: number }) => void;
  moveNode: (id: string, position: { x: number; y: number }) => void;
  connect: (parentId: string, childId: string) => void;
  disconnect: (connectionId: string) => void;
  removeNode: (id: string) => void;
  updateNode: (id: string, patch: Partial<Pick<BTNode, 'name' | 'kind'>>) => void;
  deleteSelection: () => void;
  beginGesture: () => void;
  undo: () => void;
  redo: () => void;
}

function clearIfSelected(selection: Selection, type: 'node' | 'edge', id: string): Selection {
  return selection && selection.type === type && selection.id === id ? null : selection;
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
  selection: null,
  undoStack: createRingBuffer<BehaviorTree>(HISTORY_CAPACITY),
  redoStack: createRingBuffer<BehaviorTree>(HISTORY_CAPACITY),
  setTree: (tree) =>
    set((state) => ({
      tree,
      selection: null,
      undoStack: clear(state.undoStack),
      redoStack: clear(state.redoStack),
    })),
  setSelection: (selection) => set({ selection }),
  clearSelection: () => set({ selection: null }),
  addNode: (kind, position) =>
    set((state) => withHistory(state, addNode(state.tree, kind, position))),
  moveNode: (id, position) =>
    set((state) => ({ tree: moveNode(state.tree, id, position) })),
  connect: (parentId, childId) =>
    set((state) => withHistory(state, connect(state.tree, parentId, childId))),
  disconnect: (connectionId) =>
    set((state) => {
      const nextTree = disconnect(state.tree, connectionId);
      return withHistory(state, nextTree, {
        selection: clearIfSelected(state.selection, 'edge', connectionId),
      });
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
      let selection = clearIfSelected(state.selection, 'node', id);
      if (selection && selection.type === 'edge' && removedEdgeIds.has(selection.id)) {
        selection = null;
      }
      return withHistory(state, nextTree, { selection });
    }),
  updateNode: (id, patch) =>
    set((state) => withHistory(state, updateNode(state.tree, id, patch))),
  deleteSelection: () =>
    set((state) => {
      if (!state.selection) return {};
      if (state.selection.type === 'node') {
        const nextTree = removeNode(state.tree, state.selection.id);
        return withHistory(state, nextTree, { selection: null });
      }
      const nextTree = disconnect(state.tree, state.selection.id);
      return withHistory(state, nextTree, { selection: null });
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
        selection: null,
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
        selection: null,
      };
    }),
}));
