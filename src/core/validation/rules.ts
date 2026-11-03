import type { BTDocument, BTNode, BTTreeDef, NodeKind } from '../model/node';
import type { Severity, ValidationIssue } from './types';

// R1–R8 作用於單一樹，不知道自己所屬樹的 id；validate() 從所屬的樹注入 id。
// R9 與 R10 看得到整份文件，直接產生完整的 ValidationIssue 值。
type RuleIssue = Omit<ValidationIssue, 'treeId'>;

// Group 是視覺／組織用的包裝節點：接受 0..n 個子節點，
// 並刻意排除在葉節點與分支節點規則之外。
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

// R1：恰好存在一個 Root 節點，且其 id === rootId。
export function r1RootConsistency(tree: BTTreeDef): RuleIssue[] {
  const roots = tree.nodes.filter((n) => n.kind === 'Root');
  const issues: RuleIssue[] = [];
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

// R2：Root 恰好有 1 條向外的連線。
export function r2RootHasOneChild(tree: BTTreeDef): RuleIssue[] {
  const root = tree.nodes.find((n) => n.id === tree.rootId);
  if (!root) return []; // 由 R1 回報這個問題。
  const count = outgoingCounts(tree).get(tree.rootId) ?? 0;
  if (count === 1) return [];
  const msg =
    count === 0
      ? 'Root has no child. Root must have exactly one child.'
      : `Root has ${count} children. Root must have exactly one child.`;
  return [{ ruleId: 'R2', severity: 'error', message: msg, nodeId: root.id }];
}

// R3：Action／Condition 是葉節點（0 條向外的連線）。
export function r3LeavesHaveNoChildren(tree: BTTreeDef): RuleIssue[] {
  const outgoing = outgoingCounts(tree);
  const issues: RuleIssue[] = [];
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

// R4：Sequence／Fallback／Parallel 有 ≥1 條向外的連線。
export function r4BranchesHaveChildren(tree: BTTreeDef): RuleIssue[] {
  const outgoing = outgoingCounts(tree);
  const issues: RuleIssue[] = [];
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

// R5：Decorator 恰好有 1 個子節點。
export function r5DecoratorHasOneChild(tree: BTTreeDef): RuleIssue[] {
  const outgoing = outgoingCounts(tree);
  const issues: RuleIssue[] = [];
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

// R6：有向的連線圖中沒有循環。
export function r6NoCycles(tree: BTTreeDef): RuleIssue[] {
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
    const issue: RuleIssue = {
      ruleId: 'R6',
      severity: 'error',
      message: `Cycle detected involving ${cycle.length} node${cycle.length === 1 ? '' : 's'}.`,
    };
    // 循環至少包含一個節點；為了嚴格的選用型別而縮小型別範圍。
    if (cycle[0] !== undefined) issue.nodeId = cycle[0];
    return issue;
  });
}

// R7：每個非 Root 節點有 ≤1 條進入的連線。（>1 個父節點 = error。）
export function r7AtMostOneParent(tree: BTTreeDef): RuleIssue[] {
  const incoming = incomingCounts(tree);
  const issues: RuleIssue[] = [];
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

// R8：孤立的非 Root 節點（0 條進入的連線）產生警告。
export function r8OrphanedNodes(tree: BTTreeDef): RuleIssue[] {
  const incoming = incomingCounts(tree);
  const issues: RuleIssue[] = [];
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

// R9：每個 SubTree 節點的 treeRef 必須符合文件中某個樹定義的名稱。
// 作用於整份文件；依 ADR-005 以名稱參照，
// 所以查找集合是 `doc.trees.map(t => t.name)`。
export function r9SubtreeRefExists(doc: BTDocument): ValidationIssue[] {
  const treeNames = new Set(doc.trees.map((t) => t.name));
  const issues: ValidationIssue[] = [];
  for (const tree of doc.trees) {
    for (const n of tree.nodes) {
      if (n.kind !== 'SubTree') continue;
      // schema 強制 SubTree 的 treeRef 不可為空，所以實際上 n.treeRef 在這裡
      // 一定是 string。防禦性檢查讓 R9 在處理繞過 schema 的資料時，
      // 執行期仍然正確。
      const ref = n.treeRef ?? '';
      if (!treeNames.has(ref)) {
        issues.push({
          ruleId: 'R9',
          severity: 'error',
          message: `SubTree node ${nodeLabel(n)} references unknown tree "${ref}".`,
          treeId: tree.id,
          nodeId: n.id,
        });
      }
    }
  }
  return issues;
}

// R10：不可有循環的子樹參照。參照圖以樹名稱為節點，以「樹 T 包含指向
// T' 的 SubTree」為邊。自我迴圈（T → T）與更長的循環
// （A → B → A、A → B → C → A）都會回報。指向不存在之樹的參照會被排除，
// 由 R9 回報。
//
// 每個循環以其第一棵樹（cycle[0]）作為問題的 treeId：點擊問題時，
// 使用者會被導航到那棵樹。完整的循環路徑寫在訊息中，
// 讓其他相關的樹也清楚可見。
export function r10NoCircularSubtreeRefs(doc: BTDocument): ValidationIssue[] {
  const treeNames = new Set(doc.trees.map((t) => t.name));
  const treeIdByName = new Map(doc.trees.map((t) => [t.name, t.id]));
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
    treeId: treeIdByName.get(cycle[0] ?? '') ?? '',
  }));
}
