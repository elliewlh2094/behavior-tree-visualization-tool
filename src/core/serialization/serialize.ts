import type { BehaviorTree, BTConnection, BTNode } from '../model/node';

function orderedNode(n: BTNode): Record<string, unknown> {
  return {
    id: n.id,
    kind: n.kind,
    name: n.name,
    position: { x: n.position.x, y: n.position.y },
    properties: n.properties,
  };
}

function orderedConnection(c: BTConnection): Record<string, unknown> {
  return {
    id: c.id,
    parentId: c.parentId,
    childId: c.childId,
    order: c.order,
  };
}

export function serialize(tree: BehaviorTree): string {
  const ordered = {
    version: tree.version,
    rootId: tree.rootId,
    nodes: tree.nodes.map(orderedNode),
    connections: tree.connections.map(orderedConnection),
  };
  return JSON.stringify(ordered, null, 2) + '\n';
}
