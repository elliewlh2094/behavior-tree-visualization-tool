import type { BehaviorTree, BTDocument } from '../model/node';

const DEFAULT_TREE_NAME = 'Main';

export interface MigrateOptions {
  /** Name for the migrated tree definition. Defaults to 'Main'. */
  name?: string;
}

/**
 * Wraps a v1 single-tree {@link BehaviorTree} as a v2 {@link BTDocument}
 * with one tree definition. Pure structural transform — does not validate
 * the input. Callers (e.g. `parseBTDocument`) should validate against
 * `btSchemaV1` first.
 *
 * Used both for v1 file migration (read path) and as the in-memory bridge
 * during v1.4 Phase 1 — the store still holds a v1 `BehaviorTree` until
 * T6 lands, so save-time wrapping calls this function as well.
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
