import type { BTDocument, BTNode, BTTreeDef, NodeKind } from '../model/node';
import type { Severity, ValidationIssue } from './types';

// Group is a visual/organizational wrapper — it accepts 0..n children and is
// intentionally excluded from both leaf and branch rules.
const LEAF_KINDS: NodeKind[] = ['Action', 'Condition'];
const BRANCH_KINDS: NodeKind[] = ['Sequence', 'Fallback', 'Parallel'];

function outgoingCounts(tree: BTTreeDef): Map<string, number> {
  const counts = new Map<string, number>();
  for (const c of tree.connections) {
    counts.set(c.parentId, (counts.get(c.parentId) ?? 0) + 1);
  }
  return counts;
}

function incomingCounts(tree: BTTreeDef): Map<string, number> {
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
export function r1RootConsistency(tree: BTTreeDef): ValidationIssue[] {
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
export function r2RootHasOneChild(tree: BTTreeDef): ValidationIssue[] {
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

// R3: Action / Condition are leaves (0 outgoing).
export function r3LeavesHaveNoChildren(tree: BTTreeDef): ValidationIssue[] {
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
export function r4BranchesHaveChildren(tree: BTTreeDef): ValidationIssue[] {
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
export function r5DecoratorHasOneChild(tree: BTTreeDef): ValidationIssue[] {
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
export function r6NoCycles(tree: BTTreeDef): ValidationIssue[] {
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
export function r7AtMostOneParent(tree: BTTreeDef): ValidationIssue[] {
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
export function r8OrphanedNodes(tree: BTTreeDef): ValidationIssue[] {
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

// R9: Every SubTree node's treeRef must match the name of a tree definition
// in the document. Operates on the whole document — references-by-name per
// ADR-005, so the lookup set is `doc.trees.map(t => t.name)`.
export function r9SubtreeRefExists(doc: BTDocument): ValidationIssue[] {
  const treeNames = new Set(doc.trees.map((t) => t.name));
  const issues: ValidationIssue[] = [];
  for (const tree of doc.trees) {
    for (const n of tree.nodes) {
      if (n.kind !== 'SubTree') continue;
      // Schema enforces non-empty treeRef on SubTree, so n.treeRef is a
      // string here in practice. Defensive check keeps the runtime honest
      // if R9 is called on data that bypassed the schema.
      const ref = n.treeRef ?? '';
      if (!treeNames.has(ref)) {
        issues.push({
          ruleId: 'R9',
          severity: 'error',
          message: `SubTree node ${nodeLabel(n)} references unknown tree "${ref}".`,
          nodeId: n.id,
        });
      }
    }
  }
  return issues;
}

// R10: No circular subtree references. The reference graph has tree names
// as nodes and "tree T contains a SubTree pointing at T'" as edges. Self-
// loops (T → T) and longer cycles (A → B → A, A → B → C → A) are all
// reported. Refs to non-existent trees are excluded — R9 reports those.
export function r10NoCircularSubtreeRefs(doc: BTDocument): ValidationIssue[] {
  const treeNames = new Set(doc.trees.map((t) => t.name));
  const adj = new Map<string, Set<string>>();
  for (const tree of doc.trees) {
    const refs = new Set<string>();
    for (const n of tree.nodes) {
      if (n.kind !== 'SubTree') continue;
      const ref = n.treeRef;
      if (typeof ref === 'string' && treeNames.has(ref)) {
        refs.add(ref);
      }
    }
    adj.set(tree.name, refs);
  }

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const name of treeNames) color.set(name, WHITE);
  const stack: string[] = [];
  const cycles: string[][] = [];

  function dfs(u: string): void {
    color.set(u, GRAY);
    stack.push(u);
    for (const v of adj.get(u) ?? new Set<string>()) {
      const c = color.get(v) ?? WHITE;
      if (c === WHITE) {
        dfs(v);
      } else if (c === GRAY) {
        const idx = stack.indexOf(v);
        if (idx !== -1) cycles.push([...stack.slice(idx), v]);
      }
    }
    color.set(u, BLACK);
    stack.pop();
  }

  for (const name of treeNames) {
    if ((color.get(name) ?? WHITE) === WHITE) dfs(name);
  }

  const severity: Severity = 'error';
  return cycles.map((cycle) => ({
    ruleId: 'R10' as const,
    severity,
    message: `Circular subtree reference detected: ${cycle.join(' → ')}.`,
  }));
}
