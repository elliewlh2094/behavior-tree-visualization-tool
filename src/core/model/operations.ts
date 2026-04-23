import type { BehaviorTree, BTConnection, BTNode, NodeKind } from './node';

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

export function connect(
  tree: BehaviorTree,
  parentId: string,
  childId: string,
): BehaviorTree {
  if (parentId === childId) {
    throw new Error(`connect: self-loop rejected (id=${parentId})`);
  }
  if (!tree.nodes.some((n) => n.id === parentId)) {
    throw new Error(`connect: parent not found (id=${parentId})`);
  }
  if (!tree.nodes.some((n) => n.id === childId)) {
    throw new Error(`connect: child not found (id=${childId})`);
  }
  if (
    tree.connections.some((c) => c.parentId === parentId && c.childId === childId)
  ) {
    throw new Error(`connect: duplicate edge (${parentId} → ${childId})`);
  }
  const siblingOrders = tree.connections
    .filter((c) => c.parentId === parentId)
    .map((c) => c.order);
  const nextOrder = siblingOrders.length === 0 ? 0 : Math.max(...siblingOrders) + 1;
  const connection: BTConnection = {
    id: crypto.randomUUID(),
    parentId,
    childId,
    order: nextOrder,
  };
  return { ...tree, connections: [...tree.connections, connection] };
}

export function disconnect(tree: BehaviorTree, connectionId: string): BehaviorTree {
  const index = tree.connections.findIndex((c) => c.id === connectionId);
  if (index === -1) {
    throw new Error(`disconnect: connection not found (id=${connectionId})`);
  }
  const connections = tree.connections.slice();
  connections.splice(index, 1);
  return { ...tree, connections };
}

export function updateNode(
  tree: BehaviorTree,
  id: string,
  patch: Partial<Pick<BTNode, 'name' | 'kind'>>,
): BehaviorTree {
  const index = tree.nodes.findIndex((n) => n.id === id);
  if (index === -1) {
    throw new Error(`updateNode: node not found (id=${id})`);
  }
  if (id === tree.rootId && patch.kind !== undefined && patch.kind !== 'Root') {
    throw new Error(`updateNode: cannot change the kind of the Root node`);
  }
  const target = tree.nodes[index]!;
  const updated: BTNode = { ...target, ...patch };
  const nodes = tree.nodes.slice();
  nodes[index] = updated;
  return { ...tree, nodes };
}

export function removeNode(tree: BehaviorTree, id: string): BehaviorTree {
  if (id === tree.rootId) {
    return tree;
  }
  if (!tree.nodes.some((n) => n.id === id)) {
    throw new Error(`removeNode: node not found (id=${id})`);
  }
  return {
    ...tree,
    nodes: tree.nodes.filter((n) => n.id !== id),
    connections: tree.connections.filter(
      (c) => c.parentId !== id && c.childId !== id,
    ),
  };
}
