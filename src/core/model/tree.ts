import type { BehaviorTree, BTNode } from './node';

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
