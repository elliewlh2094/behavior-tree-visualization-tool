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
  /** 被參照的樹定義名稱。只在 kind === 'SubTree' 時有意義。 */
  treeRef?: string | undefined;
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
 * {@link BTDocument} 中的一個樹定義。結構與 `BehaviorTree` 相同，但少了
 * 頂層的 `version`（version 在文件上），並多了 `id` 與 `name`，
 * 讓 SubTree 節點能參照它。
 */
export interface BTTreeDef {
  id: string;
  name: string;
  rootId: string;
  nodes: BTNode[];
  connections: BTConnection[];
}

/**
 * 檔案格式 v2 的持久化單位。保存 N 個樹定義，並透過 `mainTreeId` 指定
 * 其中一個作為進入點（`mainTreeId` 是樹的 id，不是陣列索引；
 * 次序與語意無關）。
 */
export interface BTDocument {
  version: 2;
  mainTreeId: string;
  trees: BTTreeDef[];
}

/** 回傳 UUID 字串的前 8 個字元（字串長度 ≤8 時回傳完整字串）。 */
export function shortId(id: string): string {
  return id.slice(0, 8);
}
