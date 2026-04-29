export const NODE_KINDS = [
  'Root',
  'Sequence',
  'Fallback',
  'Parallel',
  'Decorator',
  'Action',
  'Condition',
  'Group',
  'SubTree',
] as const;

export type NodeKind = (typeof NODE_KINDS)[number];

export interface BTNode {
  id: string;
  kind: NodeKind;
  name: string;
  position: { x: number; y: number };
  properties: Record<string, unknown>;
  /** Name of the referenced tree definition. Only meaningful when kind === 'SubTree'. */
  treeRef?: string;
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

/**
 * One tree definition inside a {@link BTDocument}. Shape matches `BehaviorTree`
 * minus the top-level `version` (which lives on the document) and plus an `id`
 * and `name` so SubTree nodes can reference it.
 */
export interface BTTreeDef {
  id: string;
  name: string;
  rootId: string;
  nodes: BTNode[];
  connections: BTConnection[];
}

/**
 * Persisted unit as of file format v2. Holds N tree definitions and designates
 * one as the entry point via `mainTreeId` (which is a tree id, not an array
 * index — order is independent of semantics).
 */
export interface BTDocument {
  version: 2;
  mainTreeId: string;
  trees: BTTreeDef[];
}

/** Return the first 8 characters of a UUID string (or the full string if ≤8 chars). */
export function shortId(id: string): string {
  return id.slice(0, 8);
}
