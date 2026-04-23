import { z } from 'zod';
import { NODE_KINDS } from '../model/node';
import type { BehaviorTree, BTConnection, BTNode } from '../model/node';

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
  })
  .strict();

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

export const btTreeSchema = z
  .object({
    version: z.literal(1),
    rootId: z.string().min(1),
    nodes: z.array(btNodeSchema).min(1, { message: 'tree must contain at least the Root node' }),
    connections: z.array(btConnectionSchema),
  })
  .strict()
  .superRefine((tree, ctx) => {
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
  });

// Compile-time guard: schema output must match the canonical TS types.
// If the model and schema drift, this assignment fails to type-check.
export type BTNodeFromSchema = z.infer<typeof btNodeSchema>;
export type BTConnectionFromSchema = z.infer<typeof btConnectionSchema>;
export type BTTreeFromSchema = z.infer<typeof btTreeSchema>;

const _nodeTypeCheck: BTNode = {} as BTNodeFromSchema;
const _connTypeCheck: BTConnection = {} as BTConnectionFromSchema;
const _treeTypeCheck: BehaviorTree = {} as BTTreeFromSchema;
void _nodeTypeCheck;
void _connTypeCheck;
void _treeTypeCheck;
