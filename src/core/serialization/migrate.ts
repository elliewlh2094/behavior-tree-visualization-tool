import type { BehaviorTree, BTDocument } from '../model/node';

const DEFAULT_TREE_NAME = 'Main';

export interface MigrateOptions {
  /** 遷移後樹定義的名稱。預設為 'Main'。 */
  name?: string;
}

/**
 * 把 v1 單樹的 {@link BehaviorTree} 包裝成只有一個樹定義的
 * v2 {@link BTDocument}。純粹的結構轉換，不驗證輸入。
 * 呼叫端（例如 `parseBTDocument`）應先以 `btSchemaV1` 驗證。
 *
 * 同時用於 v1 檔案遷移（讀取路徑），以及 v1.4 Phase 1 期間的記憶體內
 * 橋接：在 T6 完成之前，store 仍保存 v1 的 `BehaviorTree`，
 * 所以儲存時的包裝也會呼叫這個函式。
 */
export function migrateV1toV2(
  tree: BehaviorTree,
  opts: MigrateOptions = {},
): BTDocument {
  const name = opts.name?.trim() || DEFAULT_TREE_NAME;
  const treeId = crypto.randomUUID();
  return {
    version: 2,
    mainTreeId: treeId,
    trees: [
      {
        id: treeId,
        name,
        rootId: tree.rootId,
        nodes: tree.nodes,
        connections: tree.connections,
      },
    ],
  };
}
