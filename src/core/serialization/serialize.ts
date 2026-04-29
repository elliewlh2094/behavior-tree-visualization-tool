import type { BTConnection, BTDocument, BTNode, BTTreeDef } from '../model/node';

function orderedNode(n: BTNode): Record<string, unknown> {
  // treeRef is omitted when absent so v1-derived nodes serialize identically
  // to before v1.4 (matters for save-load-save byte-identical round-trips).
  const base: Record<string, unknown> = {
    id: n.id,
    kind: n.kind,
    name: n.name,
    position: { x: n.position.x, y: n.position.y },
    properties: n.properties,
  };
  if (n.treeRef !== undefined) base.treeRef = n.treeRef;
  return base;
}

function orderedConnection(c: BTConnection): Record<string, unknown> {
  return {
    id: c.id,
    parentId: c.parentId,
    childId: c.childId,
    order: c.order,
  };
}

function orderedTree(t: BTTreeDef): Record<string, unknown> {
  return {
    id: t.id,
    name: t.name,
    rootId: t.rootId,
    nodes: t.nodes.map(orderedNode),
    connections: t.connections.map(orderedConnection),
  };
}

export function serialize(document: BTDocument): string {
  const ordered = {
    version: document.version,
    mainTreeId: document.mainTreeId,
    trees: document.trees.map(orderedTree),
  };
  return JSON.stringify(ordered, null, 2) + '\n';
}
