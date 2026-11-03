import type { BTDocument } from '../model/node';
import type { ValidationIssue } from './types';
import {
  r1RootConsistency,
  r2RootHasOneChild,
  r3LeavesHaveNoChildren,
  r4BranchesHaveChildren,
  r5DecoratorHasOneChild,
  r6NoCycles,
  r7AtMostOneParent,
  r8OrphanedNodes,
  r9SubtreeRefExists,
  r10NoCircularSubtreeRefs,
} from './rules';

export type { ValidationIssue, Severity, RuleId } from './types';

/**
 * 對 {@link BTDocument} 執行所有驗證規則。R1–R8 以單樹為單位執行
 * （針對 `document.trees` 中的每個 `BTTreeDef`），回報的問題不含
 * 自己的 treeId；這一層把 `tree.id` 加到每個單樹問題上。
 * R9 與 R10 是文件層級的規則，直接產生完整的問題。
 */
export function validate(document: BTDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const tree of document.trees) {
    const ruleIssues = [
      ...r1RootConsistency(tree),
      ...r2RootHasOneChild(tree),
      ...r3LeavesHaveNoChildren(tree),
      ...r4BranchesHaveChildren(tree),
      ...r5DecoratorHasOneChild(tree),
      ...r6NoCycles(tree),
      ...r7AtMostOneParent(tree),
      ...r8OrphanedNodes(tree),
    ];
    for (const issue of ruleIssues) {
      issues.push({ ...issue, treeId: tree.id });
    }
  }
  issues.push(...r9SubtreeRefExists(document));
  issues.push(...r10NoCircularSubtreeRefs(document));
  return issues;
}
