import type { BTConnection, BTNode, NodeKind } from './node';

// `BehaviorTree`（檔案格式 v1）與 `BTTreeDef`（v2 BTDocument 中的一棵樹）
// 共用的結構型別。所有操作都以展開運算子保留額外的欄位
// （例如 BehaviorTree 上的 `version`、BTTreeDef 上的 `id`／`name`）。
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

// 回傳一棵新樹：被選取的節點（以及它們之間的連線）在原地被複製，
// 並依給定的差值偏移。對應 store 層的 `deleteSelection`。
//
// 篩選規則：
//   • 默默排除 Root：每棵樹只能有一個 Root。
//   • 默默排除不存在的 id。
//   • 跨越選取邊界的連線（一端在選取範圍內，一端在外）*不*複製。
//     複製出的節點在原地成為孤立節點，比照 v1.0 的先例
//     （「刪除非 Root 節點時，其子節點會失去連線」）。
//
// 沒有任何項目通過篩選時，以參照回傳輸入的樹（身分相等），
// 讓呼叫端不需要深度比較就能偵測到沒有變更。
//
// `newNodeIds` 與 `newEdgeIds` 提供新產生的 id，
// 讓 store action 能把使用者的選取切換到複製出的項目。
// 為一組節點及其之間的連線產生新的 id。回傳重建的節點（複製位置與
// properties，所以結果與輸入不共用任何可變物件）、重建的連線（透過
// `idMap` 重新對應 parent／child，保留 `order`），以及舊→新的節點 id 對應表。
// 由 `duplicateSelection`（原地複製）與 `moveCopySelection` 的 Copy 模式共用。
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
  // 在原地偏移重新產生的節點（原地複製出的孤立節點）。
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

// 把被選取的節點（以及它們之間的連線）從 `sourceTree` 轉移到 `destTree`。
// Move 保留 id，並從來源樹移除這些節點與所有相連的邊；Copy 重新產生 id，
// 不更動來源樹。跨越選取邊界的連線（一端被選取，一端沒有）一律丟棄，
// `droppedEdgeCount` 回報丟棄的數量。
//
// 驗證（Root 衝突、參照循環）是對話框的工作；
// 本函式轉移任何被選取的項目，包括 Root。
//
// 篩選後沒有任何項目時，以參照回傳兩棵樹（身分相等），
// 讓 store action 能略過歷史快照。Copy 模式一律以參照回傳 `sourceTree`
// （來源樹永遠不變）。
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

  // 計算邊界上的邊（恰好一端被選取）：兩種模式都會丟棄。
  // 內部的邊（兩端都被選取）跟著節點一起移動。
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
      sourceTree, // 未變更：以參照回傳
      destTree: {
        ...destTree,
        nodes: [...destTree.nodes, ...regen.nodes],
        connections: [...destTree.connections, ...regen.connections],
      },
      transferredNodeIds: selected.map((id) => regen.idMap.get(id)!),
      droppedEdgeCount,
    };
  }

  // Move：從來源樹移除被選取的節點與所有相連的邊；
  // 把這些節點與內部的邊（保留 id）附加到目的地樹。
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

// V1（move/copy 驗證）：把 Root 移動或複製到已經有 Root 的樹，
// 會產生兩個 Root。每棵樹都恰好有一個 Root，所以這條規則等同於
// 「選取範圍包含 Root」。兩端都檢查，讓這個輔助函式讀起來就是它所執行的規則。
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

// V2（move/copy 驗證）：如果被選取的 SubTree 的 `treeRef` 指向目的地樹，
// 它移到目的地後就會參照自己所在的樹，形成直接循環。
// 只檢查直接循環的情況；間接循環不在 v1.10 的範圍內。
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
