import { z } from 'zod';
import { NODE_KINDS } from '../model/node';
import type {
  BehaviorTree,
  BTConnection,
  BTDocument,
  BTNode,
  BTTreeDef,
} from '../model/node';
import { migrateV1toV2 } from '../serialization/migrate';

const positionSchema = z
  .object({
    x: z.number(),
    y: z.number(),
  })
  .strict();

const nodeKindSchema = z.enum(NODE_KINDS);

const btNodeSchema = z
  .object({
    id: z.string().min(1),
    kind: nodeKindSchema,
    name: z.string(),
    position: positionSchema,
    properties: z.record(z.unknown()),
    treeRef: z.string().min(1).optional(),
  })
  .strict()
  .refine(
    (n) => n.kind !== 'SubTree' || (typeof n.treeRef === 'string' && n.treeRef.length > 0),
    { message: 'SubTree node requires non-empty treeRef', path: ['treeRef'] },
  );

const btConnectionSchema = z
  .object({
    id: z.string().min(1),
    parentId: z.string().min(1),
    childId: z.string().min(1),
    order: z.number().int().nonnegative(),
  })
  .strict()
  .refine((c) => c.parentId !== c.childId, {
    message: 'connection.childId must not equal parentId (self-loop)',
    path: ['childId'],
  });

// Per-tree integrity checks. Shared between v1 (`btTreeSchema`) and v2's
// per-tree definition (`btTreeDefSchema`) — both hold the same nodes /
// connections / rootId triple, so the rules are identical.
function checkTreeIntegrity(
  tree: {
    rootId: string;
    nodes: ReadonlyArray<{ id: string; kind: string }>;
    connections: ReadonlyArray<{ id: string; parentId: string; childId: string }>;
  },
  ctx: z.RefinementCtx,
): void {
  const nodeIds = new Set<string>();
  tree.nodes.forEach((n, i) => {
    if (nodeIds.has(n.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `duplicate node id: "${n.id}"`,
        path: ['nodes', i, 'id'],
      });
    }
    nodeIds.add(n.id);
  });

  const rootMatch = tree.nodes.find((n) => n.id === tree.rootId);
  if (!rootMatch) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `rootId "${tree.rootId}" does not match any node id`,
      path: ['rootId'],
    });
  } else if (rootMatch.kind !== 'Root') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `rootId "${tree.rootId}" must reference a node with kind "Root" (was "${rootMatch.kind}")`,
      path: ['rootId'],
    });
  }

  const connIds = new Set<string>();
  tree.connections.forEach((c, i) => {
    if (connIds.has(c.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `duplicate connection id: "${c.id}"`,
        path: ['connections', i, 'id'],
      });
    }
    connIds.add(c.id);

    if (!nodeIds.has(c.parentId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `connection.parentId "${c.parentId}" does not match any node id`,
        path: ['connections', i, 'parentId'],
      });
    }
    if (!nodeIds.has(c.childId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `connection.childId "${c.childId}" does not match any node id`,
        path: ['connections', i, 'childId'],
      });
    }
  });
}

// v1 schema: a single tree as the persisted unit. Kept fully working through
// v1.4 so existing tests, fixtures, and the read-side migration path all
// continue to validate the v1 shape exactly as before.
export const btTreeSchema = z
  .object({
    version: z.literal(1),
    rootId: z.string().min(1),
    nodes: z.array(btNodeSchema).min(1, { message: 'tree must contain at least the Root node' }),
    connections: z.array(btConnectionSchema),
  })
  .strict()
  .superRefine(checkTreeIntegrity);

export const btSchemaV1 = btTreeSchema;

// v2 — per-tree definition inside a `BTDocument`. Same node/connection
// shape as v1, but the top-level tree object owns id + name and no longer
// carries a version (the version moves up to the document).
export const btTreeDefSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    rootId: z.string().min(1),
    nodes: z.array(btNodeSchema).min(1, { message: 'tree must contain at least the Root node' }),
    connections: z.array(btConnectionSchema),
  })
  .strict()
  .superRefine(checkTreeIntegrity);

// v2 — top-level document. Cross-tree refinements:
//   * tree ids unique
//   * tree names unique (SubTree.treeRef references by name; ambiguous
//     names would make R9/R10 in T5 unverifiable)
//   * mainTreeId references an existing tree.id
export const btDocumentSchemaV2 = z
  .object({
    version: z.literal(2),
    mainTreeId: z.string().min(1),
    trees: z
      .array(btTreeDefSchema)
      .min(1, { message: 'document must contain at least one tree' }),
  })
  .strict()
  .superRefine((doc, ctx) => {
    const treeIds = new Set<string>();
    const treeNames = new Set<string>();
    doc.trees.forEach((tree, i) => {
      if (treeIds.has(tree.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate tree id: "${tree.id}"`,
          path: ['trees', i, 'id'],
        });
      }
      treeIds.add(tree.id);

      if (treeNames.has(tree.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate tree name: "${tree.name}"`,
          path: ['trees', i, 'name'],
        });
      }
      treeNames.add(tree.name);
    });

    if (!treeIds.has(doc.mainTreeId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `mainTreeId "${doc.mainTreeId}" does not match any tree id`,
        path: ['mainTreeId'],
      });
    }
  });

// Compile-time guards: schema output must match the canonical TS types.
export type BTNodeFromSchema = z.infer<typeof btNodeSchema>;
export type BTConnectionFromSchema = z.infer<typeof btConnectionSchema>;
export type BTTreeFromSchema = z.infer<typeof btTreeSchema>;
export type BTTreeDefFromSchema = z.infer<typeof btTreeDefSchema>;
export type BTDocumentFromSchema = z.infer<typeof btDocumentSchemaV2>;

const _nodeTypeCheck: BTNode = {} as BTNodeFromSchema;
const _connTypeCheck: BTConnection = {} as BTConnectionFromSchema;
const _treeTypeCheck: BehaviorTree = {} as BTTreeFromSchema;
const _treeDefTypeCheck: BTTreeDef = {} as BTTreeDefFromSchema;
const _documentTypeCheck: BTDocument = {} as BTDocumentFromSchema;
void _nodeTypeCheck;
void _connTypeCheck;
void _treeTypeCheck;
void _treeDefTypeCheck;
void _documentTypeCheck;

// Document parse entry point. v2 inputs validate via btDocumentSchemaV2.
// v1 inputs validate via btSchemaV1 then migrate via migrateV1toV2 (T3).
export type ParseDocumentIssue = { path: (string | number)[]; message: string };
export type ParseDocumentError =
  | { kind: 'parse'; message: string }
  | { kind: 'schema'; issues: ParseDocumentIssue[] }
  | { kind: 'unsupported-version'; version: unknown; message: string };

export type ParseDocumentResult =
  | { ok: true; document: BTDocument }
  | { ok: false; error: ParseDocumentError };

export function parseBTDocument(input: unknown): ParseDocumentResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return {
      ok: false,
      error: { kind: 'parse', message: 'parseBTDocument: expected an object' },
    };
  }

  const version = (input as { version?: unknown }).version;

  if (version === 2) {
    const result = btDocumentSchemaV2.safeParse(input);
    if (!result.success) {
      return {
        ok: false,
        error: {
          kind: 'schema',
          issues: result.error.issues.map((i) => ({
            path: [...i.path],
            message: i.message,
          })),
        },
      };
    }
    return { ok: true, document: result.data };
  }

  if (version === 1) {
    const v1Result = btSchemaV1.safeParse(input);
    if (!v1Result.success) {
      return {
        ok: false,
        error: {
          kind: 'schema',
          issues: v1Result.error.issues.map((i) => ({
            path: [...i.path],
            message: i.message,
          })),
        },
      };
    }
    return { ok: true, document: migrateV1toV2(v1Result.data) };
  }

  return {
    ok: false,
    error: {
      kind: 'unsupported-version',
      version,
      message: `parseBTDocument: unknown or missing version field (got ${JSON.stringify(version)})`,
    },
  };
}
