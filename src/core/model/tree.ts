import type { BehaviorTree, BTDocument, BTNode } from './node';

export function createEmptyTree(): BehaviorTree {
  const rootId = crypto.randomUUID();
  const root: BTNode = {
    id: rootId,
    kind: 'Root',
    name: 'Root',
    position: { x: 0, y: 0 },
    properties: {},
  };
  return {
    version: 1,
    rootId,
    nodes: [root],
    connections: [],
  };
}

export function createEmptyDocument(): BTDocument {
  const treeId = crypto.randomUUID();
  const rootId = crypto.randomUUID();
  const root: BTNode = {
    id: rootId,
    kind: 'Root',
    name: 'Root',
    position: { x: 0, y: 0 },
    properties: {},
  };
  return {
    version: 2,
    mainTreeId: treeId,
    trees: [
      {
        id: treeId,
        name: 'Main',
        rootId,
        nodes: [root],
        connections: [],
      },
    ],
  };
}
