export type Severity = 'error' | 'warning';

export type RuleId = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7' | 'R8' | 'R9' | 'R10';

export interface ValidationIssue {
  ruleId: RuleId;
  severity: Severity;
  message: string;
  treeId: string;
  nodeId?: string;
  connectionId?: string;
}
