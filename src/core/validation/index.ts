import type { BehaviorTree } from '../model/node';
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
} from './rules';

export type { ValidationIssue, Severity, RuleId } from './types';

export function validate(tree: BehaviorTree): ValidationIssue[] {
  return [
    ...r1RootConsistency(tree),
    ...r2RootHasOneChild(tree),
    ...r3LeavesHaveNoChildren(tree),
    ...r4BranchesHaveChildren(tree),
    ...r5DecoratorHasOneChild(tree),
    ...r6NoCycles(tree),
    ...r7AtMostOneParent(tree),
    ...r8OrphanedNodes(tree),
  ];
}
