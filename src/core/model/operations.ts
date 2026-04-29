import type { BTConnection, BTNode, NodeKind } from './node';

// Structural shape shared by `BehaviorTree` (file-format v1) and `BTTreeDef`
// (one tree inside a v2 BTDocument). All operations preserve any extra fields
// (e.g. `version` on BehaviorTree, `id`/`name` on BTTreeDef) by spreading.
type Treeish = {
  rootId: string;
  nodes: BTNode[];
  connections: BTConnection[];
};

export function addNode<T extends Treeish>(
  tree: T,
  kind: NodeKind,
  position: { x: number; y: number },
): T {
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

export function moveNode<T extends Treeish>(
  tree: T,
  id: string,
  position: { x: number; y: number },
): T {
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

export function connect<T extends Treeish>(
  tree: T,
  parentId: string,
  childId: string,
): T {
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

export function disconnect<T extends Treeish>(tree: T, connectionId: string): T {
  const index = tree.connections.findIndex((c) => c.id === connectionId);
  if (index === -1) {
    throw new Error(`disconnect: connection not found (id=${connectionId})`);
  }
  const connections = tree.connections.slice();
  connections.splice(index, 1);
  return { ...tree, connections };
}

export function updateNode<T extends Treeish>(
  tree: T,
  id: string,
  patch: Partial<Pick<BTNode, 'name' | 'kind'>>,
): T {
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

export function reorderChildren<T extends Treeish>(
  tree: T,
  parentId: string,
  orderedChildIds: string[],
): T {
  const childConns = tree.connections.filter((c) => c.parentId === parentId);
  if (orderedChildIds.length !== childConns.length) {
    throw new Error(
      `reorderChildren: expected ${childConns.length} child id${childConns.length === 1 ? '' : 's'}, got ${orderedChildIds.length}`,
    );
  }
  const currentChildIds = new Set(childConns.map((c) => c.childId));
  const seen = new Set<string>();
  for (const id of orderedChildIds) {
    if (!currentChildIds.has(id)) {
      throw new Error(`reorderChildren: child ${id} is not under parent ${parentId}`);
    }
    if (seen.has(id)) {
      throw new Error(`reorderChildren: duplicate child id ${id}`);
    }
    seen.add(id);
  }

  const target = new Map<string, number>();
  orderedChildIds.forEach((childId, index) => target.set(childId, index));

  let changed = false;
  const connections = tree.connections.map((c) => {
    if (c.parentId !== parentId) return c;
    const nextOrder = target.get(c.childId)!;
    if (c.order === nextOrder) return c;
    changed = true;
    return { ...c, order: nextOrder };
  });

  if (!changed) return tree;
  return { ...tree, connections };
}

export function removeNode<T extends Treeish>(tree: T, id: string): T {
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
