import { describe, expect, it } from 'vitest';
import type {
  BehaviorTree,
  BTConnection,
  BTDocument,
  BTNode,
  NodeKind,
} from '../../../../src/core/model/node';
import { validate } from '../../../../src/core/validation';
import { migrateV1toV2 } from '../../../../src/core/serialization/migrate';
import type {
  RuleId,
  ValidationIssue,
} from '../../../../src/core/validation/types';

function node(id: string, kind: NodeKind, name = ''): BTNode {
  return { id, kind, name, position: { x: 0, y: 0 }, properties: {} };
}

function conn(id: string, parentId: string, childId: string, order = 0): BTConnection {
  return { id, parentId, childId, order };
}

function tree(opts: {
  nodes: BTNode[];
  connections?: BTConnection[];
  rootId?: string;
}): BehaviorTree {
  const rootId =
    opts.rootId ?? opts.nodes.find((n) => n.kind === 'Root')?.id ?? '';
  return {
    version: 1,
    rootId,
    nodes: opts.nodes,
    connections: opts.connections ?? [],
  };
}

function issuesFor(t: BehaviorTree, rule: RuleId): ValidationIssue[] {
  // T5: validate now takes a BTDocument; per-tree rules R1–R8 still see one
  // tree's worth of data, so wrap as a single-tree document.
  return validate(migrateV1toV2(t)).filter((i) => i.ruleId === rule);
}

describe('validate — per-rule table', () => {
  it('R1: valid tree has exactly one Root whose id matches rootId', () => {
    const t = tree({
      nodes: [node('root', 'Root'), node('a', 'Action')],
      connections: [conn('c1', 'root', 'a')],
    });
    expect(issuesFor(t, 'R1')).toEqual([]);
  });

  it('R1: flags trees with no Root', () => {
    const t = tree({
      nodes: [node('a', 'Action')],
      rootId: 'missing',
    });
    const issues = issuesFor(t, 'R1');
    expect(issues).toHaveLength(1);
    expect(issues[0]!.severity).toBe('error');
  });

  it('R1: flags each duplicate Root', () => {
    const t = tree({
      nodes: [node('r1', 'Root'), node('r2', 'Root'), node('a', 'Action')],
      rootId: 'r1',
      connections: [conn('c1', 'r1', 'a')],
    });
    const issues = issuesFor(t, 'R1');
    expect(issues).toHaveLength(2);
    expect(issues.every((i) => i.severity === 'error')).toBe(true);
  });

  it('R1: flags a mismatch between root node id and tree.rootId', () => {
    const t = tree({
      nodes: [node('root', 'Root'), node('a', 'Action')],
      rootId: 'not-the-root',
      connections: [conn('c1', 'root', 'a')],
    });
    const issues = issuesFor(t, 'R1');
    expect(issues).toHaveLength(1);
    expect(issues[0]!.nodeId).toBe('root');
  });

  it('R2: valid tree has Root with exactly one child', () => {
    const t = tree({
      nodes: [node('root', 'Root'), node('a', 'Action')],
      connections: [conn('c1', 'root', 'a')],
    });
    expect(issuesFor(t, 'R2')).toEqual([]);
  });

  it('R2: flags Root with zero children', () => {
    const t = tree({ nodes: [node('root', 'Root')] });
    const issues = issuesFor(t, 'R2');
    expect(issues).toHaveLength(1);
    expect(issues[0]!.severity).toBe('error');
    expect(issues[0]!.nodeId).toBe('root');
  });

  it('R2: flags Root with multiple children', () => {
    const t = tree({
      nodes: [node('root', 'Root'), node('a', 'Action'), node('b', 'Action')],
      connections: [conn('c1', 'root', 'a'), conn('c2', 'root', 'b')],
    });
    const issues = issuesFor(t, 'R2');
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toMatch(/2 children/);
  });

  it('R3: valid tree has Action/Condition as leaves', () => {
    const t = tree({
      nodes: [
        node('root', 'Root'),
        node('s', 'Sequence'),
        node('a', 'Action'),
        node('c', 'Condition'),
      ],
      connections: [
        conn('c1', 'root', 's'),
        conn('c2', 's', 'a'),
        conn('c3', 's', 'c'),
      ],
    });
    expect(issuesFor(t, 'R3')).toEqual([]);
  });

  it('Group accepts 0..n children without triggering R3, R4, or R5', () => {
    // Group with children (not flagged as non-leaf violation).
    const withChildren = tree({
      nodes: [
        node('root', 'Root'),
        node('g', 'Group'),
        node('a', 'Action'),
        node('b', 'Action'),
      ],
      connections: [
        conn('c1', 'root', 'g'),
        conn('c2', 'g', 'a'),
        conn('c3', 'g', 'b'),
      ],
    });
    const withIssues = validate(migrateV1toV2(withChildren));
    expect(withIssues.filter((i) => i.nodeId === 'g')).toEqual([]);

    // Group with zero children attached under Root — no rule applies to Group child-count.
    const empty = tree({
      nodes: [node('root', 'Root'), node('g', 'Group')],
      connections: [conn('c1', 'root', 'g')],
    });
    const emptyIssues = validate(migrateV1toV2(empty));
    expect(emptyIssues.filter((i) => i.nodeId === 'g')).toEqual([]);
  });

  it('R3: flags an Action with a child', () => {
    const t = tree({
      nodes: [node('root', 'Root'), node('a', 'Action'), node('b', 'Action')],
      connections: [conn('c1', 'root', 'a'), conn('c2', 'a', 'b')],
    });
    const issues = issuesFor(t, 'R3');
    expect(issues).toHaveLength(1);
    expect(issues[0]!.nodeId).toBe('a');
  });

  it('R4: valid tree has Sequence with ≥1 child', () => {
    const t = tree({
      nodes: [node('root', 'Root'), node('s', 'Sequence'), node('a', 'Action')],
      connections: [conn('c1', 'root', 's'), conn('c2', 's', 'a')],
    });
    expect(issuesFor(t, 'R4')).toEqual([]);
  });

  it('R4: flags an empty Sequence', () => {
    const t = tree({
      nodes: [node('root', 'Root'), node('s', 'Sequence')],
      connections: [conn('c1', 'root', 's')],
    });
    const issues = issuesFor(t, 'R4');
    expect(issues).toHaveLength(1);
    expect(issues[0]!.nodeId).toBe('s');
  });

  it('R5: valid tree has Decorator with exactly 1 child', () => {
    const t = tree({
      nodes: [
        node('root', 'Root'),
        node('d', 'Decorator'),
        node('a', 'Action'),
      ],
      connections: [conn('c1', 'root', 'd'), conn('c2', 'd', 'a')],
    });
    expect(issuesFor(t, 'R5')).toEqual([]);
  });

  it('R5: flags a Decorator with 0 or 2+ children', () => {
    const zero = tree({
      nodes: [node('root', 'Root'), node('d', 'Decorator')],
      connections: [conn('c1', 'root', 'd')],
    });
    expect(issuesFor(zero, 'R5')).toHaveLength(1);

    const two = tree({
      nodes: [
        node('root', 'Root'),
        node('d', 'Decorator'),
        node('a', 'Action'),
        node('b', 'Action'),
      ],
      connections: [
        conn('c1', 'root', 'd'),
        conn('c2', 'd', 'a'),
        conn('c3', 'd', 'b'),
      ],
    });
    expect(issuesFor(two, 'R5')).toHaveLength(1);
  });

  it('R6: valid tree has no cycles', () => {
    const t = tree({
      nodes: [node('root', 'Root'), node('a', 'Sequence'), node('b', 'Action')],
      connections: [conn('c1', 'root', 'a'), conn('c2', 'a', 'b')],
    });
    expect(issuesFor(t, 'R6')).toEqual([]);
  });

  it('R6: flags a simple cycle', () => {
    // root → a → b → a (cycle via back-edge b→a)
    const t = tree({
      nodes: [
        node('root', 'Root'),
        node('a', 'Sequence'),
        node('b', 'Sequence'),
      ],
      connections: [
        conn('c1', 'root', 'a'),
        conn('c2', 'a', 'b'),
        conn('c3', 'b', 'a'),
      ],
    });
    const issues = issuesFor(t, 'R6');
    expect(issues).toHaveLength(1);
    expect(issues[0]!.severity).toBe('error');
  });

  it('R7: valid tree has every non-Root node with ≤1 parent', () => {
    const t = tree({
      nodes: [node('root', 'Root'), node('s', 'Sequence'), node('a', 'Action')],
      connections: [conn('c1', 'root', 's'), conn('c2', 's', 'a')],
    });
    expect(issuesFor(t, 'R7')).toEqual([]);
  });

  it('R7: flags a node with multiple parents', () => {
    const t = tree({
      nodes: [
        node('root', 'Root'),
        node('s1', 'Sequence'),
        node('s2', 'Sequence'),
        node('a', 'Action'),
      ],
      connections: [
        conn('c1', 'root', 's1'),
        conn('c2', 'root', 's2'), // root now has 2 children; R2 fires too, but R7 is what we test
        conn('c3', 's1', 'a'),
        conn('c4', 's2', 'a'),
      ],
    });
    const issues = issuesFor(t, 'R7');
    expect(issues).toHaveLength(1);
    expect(issues[0]!.nodeId).toBe('a');
  });

  it('R8: valid tree has no orphans', () => {
    const t = tree({
      nodes: [node('root', 'Root'), node('a', 'Action')],
      connections: [conn('c1', 'root', 'a')],
    });
    expect(issuesFor(t, 'R8')).toEqual([]);
  });

  it('R8: flags an orphaned non-Root node with warning severity', () => {
    const t = tree({
      nodes: [node('root', 'Root'), node('orphan', 'Action')],
    });
    const issues = issuesFor(t, 'R8');
    expect(issues).toHaveLength(1);
    expect(issues[0]!.severity).toBe('warning');
    expect(issues[0]!.nodeId).toBe('orphan');
  });
});

describe('validate — aggregator', () => {
  it('a minimal valid tree produces zero issues', () => {
    const t = tree({
      nodes: [node('root', 'Root'), node('a', 'Action')],
      connections: [conn('c1', 'root', 'a')],
    });
    expect(validate(migrateV1toV2(t))).toEqual([]);
  });

  it('Root-only tree (fresh from createEmptyTree) produces one R2 issue', () => {
    const t = tree({ nodes: [node('root', 'Root')] });
    const issues = validate(migrateV1toV2(t));
    expect(issues).toHaveLength(1);
    expect(issues[0]!.ruleId).toBe('R2');
  });

  it('combines issues from multiple rules on the same tree', () => {
    // Decorator with 0 children triggers R5; its intended child is an orphan (R8).
    const t = tree({
      nodes: [
        node('root', 'Root'),
        node('d', 'Decorator'),
        node('orphan', 'Action'),
      ],
      connections: [conn('c1', 'root', 'd')],
    });
    const ids = new Set(validate(migrateV1toV2(t)).map((i) => i.ruleId));
    expect(ids.has('R5')).toBe(true);
    expect(ids.has('R8')).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Document-level rules: R9 (treeRef must resolve), R10 (no cycles)
// ──────────────────────────────────────────────────────────────────────────

interface DocOpts {
  trees: Array<{
    name: string;
    nodes: BTNode[];
    connections?: BTConnection[];
    rootId?: string;
  }>;
  mainName?: string;
}

function doc(opts: DocOpts): BTDocument {
  const trees = opts.trees.map((t) => {
    const rootId = t.rootId ?? t.nodes.find((n) => n.kind === 'Root')?.id ?? '';
    return {
      id: `tree-${t.name}`,
      name: t.name,
      rootId,
      nodes: t.nodes,
      connections: t.connections ?? [],
    };
  });
  const mainName = opts.mainName ?? trees[0]!.name;
  const main = trees.find((t) => t.name === mainName);
  return {
    version: 2,
    mainTreeId: main!.id,
    trees,
  };
}

function subtree(id: string, name: string, treeRef: string): BTNode {
  return {
    id,
    kind: 'SubTree',
    name,
    position: { x: 0, y: 0 },
    properties: {},
    treeRef,
  };
}

describe('R9 — SubTree.treeRef must reference an existing tree', () => {
  it('valid SubTree pointing at an existing tree produces no R9 issue', () => {
    const d = doc({
      trees: [
        {
          name: 'Main',
          nodes: [node('rm', 'Root'), subtree('s1', 'use', 'Helper')],
          connections: [conn('c1', 'rm', 's1')],
        },
        {
          name: 'Helper',
          nodes: [node('rh', 'Root')],
        },
      ],
    });
    expect(validate(d).filter((i) => i.ruleId === 'R9')).toEqual([]);
  });

  it('SubTree pointing at unknown tree triggers R9 with the offending nodeId', () => {
    const d = doc({
      trees: [
        {
          name: 'Main',
          nodes: [node('rm', 'Root'), subtree('s1', 'use-ghost', 'Ghost')],
          connections: [conn('c1', 'rm', 's1')],
        },
      ],
    });
    const r9 = validate(d).filter((i) => i.ruleId === 'R9');
    expect(r9).toHaveLength(1);
    expect(r9[0]!.severity).toBe('error');
    expect(r9[0]!.nodeId).toBe('s1');
    expect(r9[0]!.message).toContain('Ghost');
  });

  it('reports each offending SubTree node independently', () => {
    const d = doc({
      trees: [
        {
          name: 'Main',
          nodes: [
            node('rm', 'Root'),
            node('seq', 'Sequence'),
            subtree('s1', 'a', 'Ghost1'),
            subtree('s2', 'b', 'Ghost2'),
          ],
          connections: [
            conn('c1', 'rm', 'seq'),
            conn('c2', 'seq', 's1', 0),
            conn('c3', 'seq', 's2', 1),
          ],
        },
      ],
    });
    const r9 = validate(d).filter((i) => i.ruleId === 'R9');
    expect(r9.map((i) => i.nodeId).sort()).toEqual(['s1', 's2']);
  });

  it('non-SubTree nodes do not produce R9 issues', () => {
    const d = doc({
      trees: [
        {
          name: 'Main',
          nodes: [node('rm', 'Root'), node('a', 'Action')],
          connections: [conn('c1', 'rm', 'a')],
        },
      ],
    });
    expect(validate(d).filter((i) => i.ruleId === 'R9')).toEqual([]);
  });
});

describe('R10 — no circular subtree references', () => {
  it('a chain A → B → C with no cycle produces no R10 issue', () => {
    const d = doc({
      trees: [
        {
          name: 'A',
          nodes: [node('ra', 'Root'), subtree('s-ab', 'to-b', 'B')],
          connections: [conn('c1', 'ra', 's-ab')],
        },
        {
          name: 'B',
          nodes: [node('rb', 'Root'), subtree('s-bc', 'to-c', 'C')],
          connections: [conn('c2', 'rb', 's-bc')],
        },
        { name: 'C', nodes: [node('rc', 'Root')] },
      ],
    });
    expect(validate(d).filter((i) => i.ruleId === 'R10')).toEqual([]);
  });

  it('detects a self-cycle (tree references itself)', () => {
    const d = doc({
      trees: [
        {
          name: 'A',
          nodes: [node('ra', 'Root'), subtree('s-aa', 'self', 'A')],
          connections: [conn('c1', 'ra', 's-aa')],
        },
      ],
    });
    const r10 = validate(d).filter((i) => i.ruleId === 'R10');
    expect(r10).toHaveLength(1);
    expect(r10[0]!.message).toContain('A → A');
  });

  it('detects a 2-cycle A → B → A', () => {
    const d = doc({
      trees: [
        {
          name: 'A',
          nodes: [node('ra', 'Root'), subtree('s-ab', 'to-b', 'B')],
          connections: [conn('c1', 'ra', 's-ab')],
        },
        {
          name: 'B',
          nodes: [node('rb', 'Root'), subtree('s-ba', 'to-a', 'A')],
          connections: [conn('c2', 'rb', 's-ba')],
        },
      ],
    });
    const r10 = validate(d).filter((i) => i.ruleId === 'R10');
    expect(r10).toHaveLength(1);
    expect(r10[0]!.message).toMatch(/A → B → A|B → A → B/);
  });

  it('detects a 3-cycle A → B → C → A', () => {
    const d = doc({
      trees: [
        {
          name: 'A',
          nodes: [node('ra', 'Root'), subtree('s1', 'to-b', 'B')],
          connections: [conn('c1', 'ra', 's1')],
        },
        {
          name: 'B',
          nodes: [node('rb', 'Root'), subtree('s2', 'to-c', 'C')],
          connections: [conn('c2', 'rb', 's2')],
        },
        {
          name: 'C',
          nodes: [node('rc', 'Root'), subtree('s3', 'to-a', 'A')],
          connections: [conn('c3', 'rc', 's3')],
        },
      ],
    });
    const r10 = validate(d).filter((i) => i.ruleId === 'R10');
    expect(r10).toHaveLength(1);
    expect(r10[0]!.message).toMatch(/(A → B → C → A|B → C → A → B|C → A → B → C)/);
  });

  it('does not report R10 for refs to non-existent trees (R9 owns those)', () => {
    const d = doc({
      trees: [
        {
          name: 'A',
          nodes: [node('ra', 'Root'), subtree('s', 'ghost', 'Ghost')],
          connections: [conn('c1', 'ra', 's')],
        },
      ],
    });
    const r10 = validate(d).filter((i) => i.ruleId === 'R10');
    expect(r10).toEqual([]);
  });
});

describe('validate — issues carry the originating tree id', () => {
  it('per-tree rules (R1–R8) stamp treeId with the containing tree', () => {
    const d = doc({
      trees: [
        // Main is well-formed.
        {
          name: 'Main',
          nodes: [node('rm', 'Root'), node('a', 'Action')],
          connections: [conn('cm', 'rm', 'a')],
        },
        // Patrol violates R2 (Root has no child).
        {
          name: 'Patrol',
          nodes: [node('rp', 'Root')],
        },
      ],
    });
    const issues = validate(d);
    const r2 = issues.find((i) => i.ruleId === 'R2');
    expect(r2?.treeId).toBe('tree-Patrol');
    // Sanity: every issue carries some treeId.
    expect(issues.every((i) => typeof i.treeId === 'string' && i.treeId.length > 0)).toBe(true);
  });

  it('R9 stamps treeId with the tree containing the offending SubTree node, not the missing tree', () => {
    const d = doc({
      trees: [
        {
          name: 'Main',
          nodes: [node('rm', 'Root'), subtree('s1', 'use-ghost', 'Ghost')],
          connections: [conn('c1', 'rm', 's1')],
        },
      ],
    });
    const r9 = validate(d).filter((i) => i.ruleId === 'R9');
    expect(r9).toHaveLength(1);
    expect(r9[0]!.treeId).toBe('tree-Main');
  });

  it('R10 stamps treeId with the first tree in the cycle path', () => {
    const d = doc({
      trees: [
        {
          name: 'Main',
          nodes: [node('rm', 'Root'), subtree('s1', 'to-patrol', 'Patrol')],
          connections: [conn('c1', 'rm', 's1')],
        },
        {
          name: 'Patrol',
          nodes: [node('rp', 'Root'), subtree('s2', 'to-main', 'Main')],
          connections: [conn('c2', 'rp', 's2')],
        },
      ],
    });
    const r10 = validate(d).filter((i) => i.ruleId === 'R10');
    expect(r10).toHaveLength(1);
    // DFS starts from the first tree (`Main`); the reported cycle is anchored
    // there, so the issue's treeId should be Main's.
    expect(r10[0]!.treeId).toBe('tree-Main');
  });
});
