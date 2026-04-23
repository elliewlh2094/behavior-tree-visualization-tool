import { create } from 'zustand';
import type { BehaviorTree, NodeKind } from '../core/model/node';
import { createEmptyTree } from '../core/model/tree';
import {
  addNode,
  connect,
  disconnect,
  moveNode,
  removeNode,
} from '../core/model/operations';

export type Selection = { type: 'node' | 'edge'; id: string } | null;

export interface BTStoreState {
  tree: BehaviorTree;
  selection: Selection;
  setTree: (tree: BehaviorTree) => void;
  setSelection: (selection: Selection) => void;
  clearSelection: () => void;
  addNode: (kind: NodeKind, position: { x: number; y: number }) => void;
  moveNode: (id: string, position: { x: number; y: number }) => void;
  connect: (parentId: string, childId: string) => void;
  disconnect: (connectionId: string) => void;
  removeNode: (id: string) => void;
  deleteSelection: () => void;
}

function clearIfSelected(selection: Selection, type: 'node' | 'edge', id: string): Selection {
  return selection && selection.type === type && selection.id === id ? null : selection;
}

export const useBTStore = create<BTStoreState>((set) => ({
  tree: createEmptyTree(),
  selection: null,
  setTree: (tree) => set({ tree, selection: null }),
  setSelection: (selection) => set({ selection }),
  clearSelection: () => set({ selection: null }),
  addNode: (kind, position) =>
    set((state) => ({ tree: addNode(state.tree, kind, position) })),
  moveNode: (id, position) =>
    set((state) => ({ tree: moveNode(state.tree, id, position) })),
  connect: (parentId, childId) =>
    set((state) => ({ tree: connect(state.tree, parentId, childId) })),
  disconnect: (connectionId) =>
    set((state) => ({
      tree: disconnect(state.tree, connectionId),
      selection: clearIfSelected(state.selection, 'edge', connectionId),
    })),
  removeNode: (id) =>
    set((state) => {
      const nextTree = removeNode(state.tree, id);
      if (nextTree === state.tree) return {};
      // Any connections pruned by the removal must also drop their selection.
      const removedEdgeIds = new Set(
        state.tree.connections
          .filter((c) => c.parentId === id || c.childId === id)
          .map((c) => c.id),
      );
      let selection = clearIfSelected(state.selection, 'node', id);
      if (selection && selection.type === 'edge' && removedEdgeIds.has(selection.id)) {
        selection = null;
      }
      return { tree: nextTree, selection };
    }),
  deleteSelection: () =>
    set((state) => {
      if (!state.selection) return {};
      if (state.selection.type === 'node') {
        const nextTree = removeNode(state.tree, state.selection.id);
        if (nextTree === state.tree) return {};
        return { tree: nextTree, selection: null };
      }
      return {
        tree: disconnect(state.tree, state.selection.id),
        selection: null,
      };
    }),
}));
