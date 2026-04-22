export const NODE_KINDS = [
  'Root',
  'Sequence',
  'Fallback',
  'Parallel',
  'Decorator',
  'Action',
  'Condition',
  'SubTree',
] as const;

export type NodeKind = (typeof NODE_KINDS)[number];

export interface BTNode {
  id: string;
  kind: NodeKind;
  name: string;
  position: { x: number; y: number };
  properties: Record<string, unknown>;
}

export interface BTConnection {
  id: string;
  parentId: string;
  childId: string;
  order: number;
}

export interface BehaviorTree {
  version: 1;
  rootId: string;
  nodes: BTNode[];
  connections: BTConnection[];
}
