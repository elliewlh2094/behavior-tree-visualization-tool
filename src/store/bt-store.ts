import { create } from 'zustand';
import type { BehaviorTree } from '../core/model/node';
import { createEmptyTree } from '../core/model/tree';

export interface BTStoreState {
  tree: BehaviorTree;
  setTree: (tree: BehaviorTree) => void;
}

export const useBTStore = create<BTStoreState>((set) => ({
  tree: createEmptyTree(),
  setTree: (tree) => set({ tree }),
}));
