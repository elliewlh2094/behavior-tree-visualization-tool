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
 * Run all validation rules against a {@link BTDocument}. R1–R8 run per-tree
 * (over each `BTTreeDef` in `document.trees`) and report issues without their
 * own treeId; this layer stamps `tree.id` onto every per-tree issue. R9 and
 * R10 are document-level rules that emit fully-formed issues directly.
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
