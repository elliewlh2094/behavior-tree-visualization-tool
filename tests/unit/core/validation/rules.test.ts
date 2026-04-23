import { describe, expect, it } from 'vitest';
import type {
  BehaviorTree,
  BTConnection,
  BTNode,
  NodeKind,
} from '../../../../src/core/model/node';
import { validate } from '../../../../src/core/validation';
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
  return validate(t).filter((i) => i.ruleId === rule);
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
    const withIssues = validate(withChildren);
    expect(withIssues.filter((i) => i.nodeId === 'g')).toEqual([]);

    // Group with zero children attached under Root — no rule applies to Group child-count.
    const empty = tree({
      nodes: [node('root', 'Root'), node('g', 'Group')],
      connections: [conn('c1', 'root', 'g')],
    });
    const emptyIssues = validate(empty);
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
    expect(validate(t)).toEqual([]);
  });

  it('Root-only tree (fresh from createEmptyTree) produces one R2 issue', () => {
    const t = tree({ nodes: [node('root', 'Root')] });
    const issues = validate(t);
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
    const ids = new Set(validate(t).map((i) => i.ruleId));
    expect(ids.has('R5')).toBe(true);
    expect(ids.has('R8')).toBe(true);
  });
});
