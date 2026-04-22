import { create } from 'zustand';
import type { BehaviorTree, NodeKind } from '../core/model/node';
import { createEmptyTree } from '../core/model/tree';
import { addNode, moveNode } from '../core/model/operations';

export interface BTStoreState {
  tree: BehaviorTree;
  setTree: (tree: BehaviorTree) => void;
  addNode: (kind: NodeKind, position: { x: number; y: number }) => void;
  moveNode: (id: string, position: { x: number; y: number }) => void;
}

export const useBTStore = create<BTStoreState>((set) => ({
  tree: createEmptyTree(),
  setTree: (tree) => set({ tree }),
  addNode: (kind, position) =>
    set((state) => ({ tree: addNode(state.tree, kind, position) })),
  moveNode: (id, position) =>
    set((state) => ({ tree: moveNode(state.tree, id, position) })),
}));
