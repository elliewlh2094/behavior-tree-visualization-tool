import type { BehaviorTree, BTNode, NodeKind } from './node';

export function addNode(
  tree: BehaviorTree,
  kind: NodeKind,
  position: { x: number; y: number },
): BehaviorTree {
  if (kind === 'Root') {
    throw new Error('Cannot add a second Root node — the tree has exactly one Root.');
  }
  const node: BTNode = {
    id: crypto.randomUUID(),
    kind,
    name: '',
    position: { ...position },
    properties: {},
  };
  return { ...tree, nodes: [...tree.nodes, node] };
}

export function moveNode(
  tree: BehaviorTree,
  id: string,
  position: { x: number; y: number },
): BehaviorTree {
  const index = tree.nodes.findIndex((n) => n.id === id);
  if (index === -1) {
    throw new Error(`moveNode: node not found (id=${id})`);
  }
  const target = tree.nodes[index]!;
  const moved: BTNode = { ...target, position: { ...position } };
  const nodes = tree.nodes.slice();
  nodes[index] = moved;
  return { ...tree, nodes };
}
