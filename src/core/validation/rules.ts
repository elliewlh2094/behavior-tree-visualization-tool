import type { BehaviorTree, BTNode, NodeKind } from '../model/node';
import type { ValidationIssue } from './types';

const LEAF_KINDS: NodeKind[] = ['Action', 'Condition', 'SubTree'];
const BRANCH_KINDS: NodeKind[] = ['Sequence', 'Fallback', 'Parallel'];

function outgoingCounts(tree: BehaviorTree): Map<string, number> {
  const counts = new Map<string, number>();
  for (const c of tree.connections) {
    counts.set(c.parentId, (counts.get(c.parentId) ?? 0) + 1);
  }
  return counts;
}

function incomingCounts(tree: BehaviorTree): Map<string, number> {
  const counts = new Map<string, number>();
  for (const c of tree.connections) {
    counts.set(c.childId, (counts.get(c.childId) ?? 0) + 1);
  }
  return counts;
}

function nodeLabel(n: BTNode): string {
  return n.name ? `"${n.name}"` : n.kind;
}

// R1: Exactly one Root node exists, and its id === rootId.
export function r1RootConsistency(tree: BehaviorTree): ValidationIssue[] {
  const roots = tree.nodes.filter((n) => n.kind === 'Root');
  const issues: ValidationIssue[] = [];
  if (roots.length === 0) {
    issues.push({
      ruleId: 'R1',
      severity: 'error',
      message: 'No Root node found. Every tree must have exactly one Root.',
    });
    return issues;
  }
  if (roots.length > 1) {
    for (const r of roots) {
      issues.push({
        ruleId: 'R1',
        severity: 'error',
        message: `Multiple Root nodes found; duplicate Root ${nodeLabel(r)}.`,
        nodeId: r.id,
      });
    }
    return issues;
  }
  const [only] = roots;
  if (only && only.id !== tree.rootId) {
    issues.push({
      ruleId: 'R1',
      severity: 'error',
      message: `Root node id (${only.id}) does not match tree rootId (${tree.rootId}).`,
      nodeId: only.id,
    });
  }
  return issues;
}

// R2: Root has exactly 1 outgoing connection.
export function r2RootHasOneChild(tree: BehaviorTree): ValidationIssue[] {
  const root = tree.nodes.find((n) => n.id === tree.rootId);
  if (!root) return []; // R1 will report this.
  const count = outgoingCounts(tree).get(tree.rootId) ?? 0;
  if (count === 1) return [];
  const msg =
    count === 0
      ? 'Root has no child. Root must have exactly one child.'
      : `Root has ${count} children. Root must have exactly one child.`;
  return [{ ruleId: 'R2', severity: 'error', message: msg, nodeId: root.id }];
}

// R3: Action / Condition / SubTree are leaves (0 outgoing).
export function r3LeavesHaveNoChildren(tree: BehaviorTree): ValidationIssue[] {
  const outgoing = outgoingCounts(tree);
  const issues: ValidationIssue[] = [];
  for (const n of tree.nodes) {
    if (!LEAF_KINDS.includes(n.kind)) continue;
    const count = outgoing.get(n.id) ?? 0;
    if (count > 0) {
      issues.push({
        ruleId: 'R3',
        severity: 'error',
        message: `${n.kind} ${nodeLabel(n)} must be a leaf but has ${count} ${count === 1 ? 'child' : 'children'}.`,
        nodeId: n.id,
      });
    }
  }
  return issues;
}

// R4: Sequence / Fallback / Parallel have ≥1 outgoing connection.
export function r4BranchesHaveChildren(tree: BehaviorTree): ValidationIssue[] {
  const outgoing = outgoingCounts(tree);
  const issues: ValidationIssue[] = [];
  for (const n of tree.nodes) {
    if (!BRANCH_KINDS.includes(n.kind)) continue;
    const count = outgoing.get(n.id) ?? 0;
    if (count === 0) {
      issues.push({
        ruleId: 'R4',
        severity: 'error',
        message: `${n.kind} ${nodeLabel(n)} has no children; composite nodes require at least one child.`,
        nodeId: n.id,
      });
    }
  }
  return issues;
}

// R5: Decorator has exactly 1 child.
export function r5DecoratorHasOneChild(tree: BehaviorTree): ValidationIssue[] {
  const outgoing = outgoingCounts(tree);
  const issues: ValidationIssue[] = [];
  for (const n of tree.nodes) {
    if (n.kind !== 'Decorator') continue;
    const count = outgoing.get(n.id) ?? 0;
    if (count !== 1) {
      issues.push({
        ruleId: 'R5',
        severity: 'error',
        message: `Decorator ${nodeLabel(n)} has ${count} ${count === 1 ? 'child' : 'children'}; must have exactly one.`,
        nodeId: n.id,
      });
    }
  }
  return issues;
}

// R6: No cycles in the directed connection graph.
export function r6NoCycles(tree: BehaviorTree): ValidationIssue[] {
  const adj = new Map<string, string[]>();
  for (const c of tree.connections) {
    const list = adj.get(c.parentId);
    if (list) list.push(c.childId);
    else adj.set(c.parentId, [c.childId]);
  }
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const n of tree.nodes) color.set(n.id, WHITE);
  const stack: string[] = [];
  const cycles: string[][] = [];

  function dfs(u: string): void {
    color.set(u, GRAY);
    stack.push(u);
    for (const v of adj.get(u) ?? []) {
      const c = color.get(v) ?? WHITE;
      if (c === WHITE) {
        dfs(v);
      } else if (c === GRAY) {
        const idx = stack.indexOf(v);
        if (idx !== -1) cycles.push(stack.slice(idx));
      }
    }
    color.set(u, BLACK);
    stack.pop();
  }

  for (const n of tree.nodes) {
    if ((color.get(n.id) ?? WHITE) === WHITE) dfs(n.id);
  }

  return cycles.map((cycle) => {
    const issue: ValidationIssue = {
      ruleId: 'R6',
      severity: 'error',
      message: `Cycle detected involving ${cycle.length} node${cycle.length === 1 ? '' : 's'}.`,
    };
    // A cycle always contains at least one node; narrow for strict optional typing.
    if (cycle[0] !== undefined) issue.nodeId = cycle[0];
    return issue;
  });
}

// R7: Every non-Root node has ≤1 incoming connection. (>1 parents = error.)
export function r7AtMostOneParent(tree: BehaviorTree): ValidationIssue[] {
  const incoming = incomingCounts(tree);
  const issues: ValidationIssue[] = [];
  for (const n of tree.nodes) {
    if (n.id === tree.rootId) continue;
    const count = incoming.get(n.id) ?? 0;
    if (count > 1) {
      issues.push({
        ruleId: 'R7',
        severity: 'error',
        message: `${n.kind} ${nodeLabel(n)} has ${count} parents; non-Root nodes must have at most one.`,
        nodeId: n.id,
      });
    }
  }
  return issues;
}

// R8: Orphaned non-Root nodes (0 incoming) produce a warning.
export function r8OrphanedNodes(tree: BehaviorTree): ValidationIssue[] {
  const incoming = incomingCounts(tree);
  const issues: ValidationIssue[] = [];
  for (const n of tree.nodes) {
    if (n.id === tree.rootId) continue;
    const count = incoming.get(n.id) ?? 0;
    if (count === 0) {
      issues.push({
        ruleId: 'R8',
        severity: 'warning',
        message: `${n.kind} ${nodeLabel(n)} is orphaned (no parent).`,
        nodeId: n.id,
      });
    }
  }
  return issues;
}
