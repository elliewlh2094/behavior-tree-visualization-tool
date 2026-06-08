import type { BTConnection, BTNode, NodeKind } from './node';

// Structural shape shared by `BehaviorTree` (file-format v1) and `BTTreeDef`
// (one tree inside a v2 BTDocument). All operations preserve any extra fields
// (e.g. `version` on BehaviorTree, `id`/`name` on BTTreeDef) by spreading.
export type Treeish = {
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
  patch: Partial<Pick<BTNode, 'name' | 'kind' | 'treeRef'>>,
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

// Returns a new tree with the selected nodes (and the connections among them)
// duplicated in place, offset by the given deltas. Companion of `deleteSelection`
// in the store layer.
//
// Filter rules:
//   • Root is silently excluded — only one Root per tree.
//   • Unknown ids are silently excluded.
//   • Connections crossing the selection boundary (one endpoint inside, one
//     outside) are NOT copied. Duplicates land orphaned-in-place, matching
//     the v1.0 precedent ("deleting a non-Root node leaves children
//     disconnected").
//
// When nothing survives the filter, the input tree is returned by reference
// (identity-equal) so callers can detect a no-op without a deep diff.
//
// `newNodeIds` and `newEdgeIds` expose the freshly-minted ids so the store
// action can swap the user's selection to the duplicates.
// Mints fresh ids for a node set and the connections among them. Returns the
// rebuilt nodes (positions + properties cloned, so the result shares nothing
// mutable with the input), the rebuilt connections (parent/child remapped
// through `idMap`, `order` preserved), and the old→new node id map. Shared by
// `duplicateSelection` (Copy-in-place) and `moveCopySelection` Copy-mode.
export function regenerateIds(
  nodes: readonly BTNode[],
  connections: readonly BTConnection[],
): { nodes: BTNode[]; connections: BTConnection[]; idMap: Map<string, string> } {
  const idMap = new Map<string, string>();
  for (const n of nodes) idMap.set(n.id, crypto.randomUUID());

  const newNodes: BTNode[] = nodes.map((src) => ({
    ...src,
    id: idMap.get(src.id)!,
    position: { ...src.position },
    properties: { ...src.properties },
  }));

  const newConnections: BTConnection[] = connections.map((c) => ({
    id: crypto.randomUUID(),
    parentId: idMap.get(c.parentId)!,
    childId: idMap.get(c.childId)!,
    order: c.order,
  }));

  return { nodes: newNodes, connections: newConnections, idMap };
}

export function duplicateSelection<T extends Treeish>(
  tree: T,
  nodeIds: ReadonlySet<string>,
  options: { offsetX: number; offsetY: number },
): { tree: T; newNodeIds: Set<string>; newEdgeIds: Set<string> } {
  const existingNodeIds = new Set(tree.nodes.map((n) => n.id));
  const sources: string[] = [];
  for (const id of nodeIds) {
    if (id === tree.rootId) continue;
    if (!existingNodeIds.has(id)) continue;
    sources.push(id);
  }

  if (sources.length === 0) {
    return { tree, newNodeIds: new Set(), newEdgeIds: new Set() };
  }

  const sourceSet = new Set(sources);
  const nodesById = new Map(tree.nodes.map((n) => [n.id, n] as const));
  const sourceNodes = sources.map((id) => nodesById.get(id)!);
  const internalConns = tree.connections.filter(
    (c) => sourceSet.has(c.parentId) && sourceSet.has(c.childId),
  );

  const regen = regenerateIds(sourceNodes, internalConns);
  // Offset the regenerated nodes in place (orphaned-in-place duplicate).
  const newNodes = regen.nodes.map((n) => ({
    ...n,
    position: { x: n.position.x + options.offsetX, y: n.position.y + options.offsetY },
  }));

  return {
    tree: {
      ...tree,
      nodes: [...tree.nodes, ...newNodes],
      connections: [...tree.connections, ...regen.connections],
    },
    newNodeIds: new Set(regen.idMap.values()),
    newEdgeIds: new Set(regen.connections.map((c) => c.id)),
  };
}

export interface MoveCopyInput<S extends Treeish, D extends Treeish> {
  sourceTree: S;
  destTree: D;
  selectedNodeIds: ReadonlySet<string>;
  mode: 'move' | 'copy';
}

export interface MoveCopyResult<S extends Treeish, D extends Treeish> {
  sourceTree: S;
  destTree: D;
  transferredNodeIds: string[];
  droppedEdgeCount: number;
}

// Transfers the selected nodes (and the connections among them) from
// `sourceTree` into `destTree`. Move preserves ids and removes the nodes +
// every touching edge from the source; Copy regenerates ids and leaves the
// source untouched. Connections crossing the selection boundary (one endpoint
// selected, one not) are always dropped — `droppedEdgeCount` reports how many.
//
// Validation (Root conflict, reference cycles) is the modal's job — this
// function transfers whatever is selected, Root included.
//
// When nothing resolves after filtering, both trees are returned by reference
// (identity-equal) so the store action can skip a history snapshot. Copy mode
// always returns `sourceTree` by reference (the source never changes).
export function moveCopySelection<S extends Treeish, D extends Treeish>(
  input: MoveCopyInput<S, D>,
): MoveCopyResult<S, D> {
  const { sourceTree, destTree, selectedNodeIds, mode } = input;

  const existing = new Set(sourceTree.nodes.map((n) => n.id));
  const selected: string[] = [];
  const selectedSet = new Set<string>();
  for (const id of selectedNodeIds) {
    if (!existing.has(id) || selectedSet.has(id)) continue;
    selected.push(id);
    selectedSet.add(id);
  }

  // Count boundary edges (exactly one endpoint selected) — dropped in both
  // modes. Internal edges (both endpoints selected) travel with the nodes.
  let droppedEdgeCount = 0;
  const internalConns: BTConnection[] = [];
  for (const c of sourceTree.connections) {
    const pIn = selectedSet.has(c.parentId);
    const cIn = selectedSet.has(c.childId);
    if (pIn && cIn) internalConns.push(c);
    else if (pIn || cIn) droppedEdgeCount += 1;
  }

  if (selected.length === 0) {
    return { sourceTree, destTree, transferredNodeIds: [], droppedEdgeCount: 0 };
  }

  const nodesById = new Map(sourceTree.nodes.map((n) => [n.id, n] as const));
  const selectedNodes = selected.map((id) => nodesById.get(id)!);

  if (mode === 'copy') {
    const regen = regenerateIds(selectedNodes, internalConns);
    return {
      sourceTree, // unchanged — by reference
      destTree: {
        ...destTree,
        nodes: [...destTree.nodes, ...regen.nodes],
        connections: [...destTree.connections, ...regen.connections],
      },
      transferredNodeIds: selected.map((id) => regen.idMap.get(id)!),
      droppedEdgeCount,
    };
  }

  // Move: remove selected nodes + every edge touching them from the source;
  // append the nodes + internal edges (ids preserved) to the destination.
  return {
    sourceTree: {
      ...sourceTree,
      nodes: sourceTree.nodes.filter((n) => !selectedSet.has(n.id)),
      connections: sourceTree.connections.filter(
        (c) => !selectedSet.has(c.parentId) && !selectedSet.has(c.childId),
      ),
    },
    destTree: {
      ...destTree,
      nodes: [...destTree.nodes, ...selectedNodes],
      connections: [...destTree.connections, ...internalConns],
    },
    transferredNodeIds: selected,
    droppedEdgeCount,
  };
}

// V1 (move/copy validation): moving or copying a Root into a tree that already
// has one would create two Roots. Every tree carries exactly one Root, so this
// reduces to "the selection contains a Root" — both sides are checked so the
// helper reads as the rule it enforces.
export function wouldCreateRootConflict(
  sourceTree: Treeish,
  selectedNodeIds: ReadonlySet<string>,
  destTree: Treeish,
): boolean {
  const selectionHasRoot = sourceTree.nodes.some(
    (n) => selectedNodeIds.has(n.id) && n.kind === 'Root',
  );
  const destHasRoot = destTree.nodes.some((n) => n.kind === 'Root');
  return selectionHasRoot && destHasRoot;
}

// V2 (move/copy validation): a selected SubTree whose `treeRef` names the
// destination would, once it lives in the destination, reference its own tree —
// a direct cycle. Only the direct case is checked; transitive cycles are out of
// scope for v1.10.
export function wouldCreateCycle(
  sourceTree: Treeish,
  selectedNodeIds: ReadonlySet<string>,
  destTreeName: string,
): boolean {
  return sourceTree.nodes.some(
    (n) =>
      selectedNodeIds.has(n.id) && n.kind === 'SubTree' && n.treeRef === destTreeName,
  );
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
