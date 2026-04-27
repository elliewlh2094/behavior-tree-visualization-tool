import { useMemo } from 'react';
import { useBTStore } from '../../store/bt-store';
import type { Severity, ValidationIssue } from '../../core/validation/types';

const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1 };

function sortIssues(issues: ValidationIssue[]): ValidationIssue[] {
  return [...issues].sort((a, b) => {
    const s = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (s !== 0) return s;
    return a.ruleId.localeCompare(b.ruleId);
  });
}

export function ValidationPanel() {
  const issues = useBTStore((s) => s.validationIssues);
  const close = useBTStore((s) => s.closeValidationPanel);
  const setSelection = useBTStore((s) => s.setSelection);

  const sorted = useMemo(() => (issues ? sortIssues(issues) : []), [issues]);
  const errorCount = useMemo(
    () => sorted.filter((i) => i.severity === 'error').length,
    [sorted],
  );
  const warningCount = sorted.length - errorCount;

  if (issues === null) return null;

  return (
    <section
      aria-label="Validation results"
      className="flex max-h-64 min-h-32 flex-col border-t border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
    >
      <header className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-700">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-semibold text-slate-900 dark:text-slate-100">Validation</span>
          <span className="text-slate-600 dark:text-slate-400">
            {sorted.length === 0
              ? 'All checks passed.'
              : `${errorCount} error${errorCount === 1 ? '' : 's'}, ${warningCount} warning${warningCount === 1 ? '' : 's'}`}
          </span>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close validation panel"
          className="rounded-lg border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          Close
        </button>
      </header>

      {sorted.length === 0 ? (
        <div className="px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
          No structural issues detected.
        </div>
      ) : (
        <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-700">
          {sorted.map((issue, idx) => {
            const canSelect = Boolean(issue.nodeId);
            const rowBase =
              'flex w-full items-start gap-3 px-3 py-2 text-left text-sm';
            const rowInteractive = canSelect
              ? 'cursor-pointer hover:bg-slate-50 focus:outline-none focus:bg-sky-50 dark:hover:bg-slate-700 dark:focus:bg-sky-950'
              : 'cursor-default';
            return (
              <li key={`${issue.ruleId}-${idx}`}>
                <button
                  type="button"
                  disabled={!canSelect}
                  onClick={() => {
                    if (issue.nodeId) {
                      setSelection({
                        nodeIds: new Set([issue.nodeId]),
                        edgeIds: new Set(),
                      });
                    }
                  }}
                  className={`${rowBase} ${rowInteractive}`}
                >
                  <SeverityBadge severity={issue.severity} />
                  <span className="min-w-[2.25rem] font-mono text-xs text-slate-500 dark:text-slate-400">
                    {issue.ruleId}
                  </span>
                  <span className="flex-1 text-slate-800 dark:text-slate-200">{issue.message}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function SeverityBadge({ severity }: { severity: Severity }) {
  const styles =
    severity === 'error'
      ? 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
      : 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
  return (
    <span
      aria-label={severity}
      className={`mt-0.5 inline-block min-w-[3.75rem] rounded border px-1.5 py-0.5 text-center text-xs font-medium uppercase ${styles}`}
    >
      {severity}
    </span>
  );
}
