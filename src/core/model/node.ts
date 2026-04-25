export const NODE_KINDS = [
  'Root',
  'Sequence',
  'Fallback',
  'Parallel',
  'Decorator',
  'Action',
  'Condition',
  'Group',
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

/** Return the first 8 characters of a UUID string (or the full string if ≤8 chars). */
export function shortId(id: string): string {
  return id.slice(0, 8);
}
