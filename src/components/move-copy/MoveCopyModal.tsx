import { useEffect, useMemo, useState } from 'react';
import { selectActiveTree, useBTStore } from '../../store/bt-store';
import { wouldCreateCycle, wouldCreateRootConflict } from '../../core/model/operations';

interface MoveCopyModalProps {
  onClose: () => void;
}

type Mode = 'move' | 'copy';

const MODES: { value: Mode; label: string }[] = [
  { value: 'move', label: 'Move' },
  { value: 'copy', label: 'Copy' },
];

export function MoveCopyModal({ onClose }: MoveCopyModalProps) {
  const trees = useBTStore((s) => s.document.trees);
  const activeTreeId = useBTStore((s) => s.activeTreeId);
  const sourceTree = useBTStore(selectActiveTree);
  const selectedNodeIds = useBTStore((s) => s.selection.nodeIds);
  const moveCopyToTree = useBTStore((s) => s.moveCopyToTree);

  // Destinations are every tree except the active one, in document order
  // (so the picker reflects the user's tab arrangement from Phase A).
  const destinations = useMemo(
    () => trees.filter((t) => t.id !== activeTreeId),
    [trees, activeTreeId],
  );

  const [destId, setDestId] = useState(() => destinations[0]?.id ?? '');
  const [mode, setMode] = useState<Mode>('move');

  // Esc closes (listen on document — focus may be on any control).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const destTree = destinations.find((t) => t.id === destId);

  // Selection counts (nodes that actually exist in the source) + edge split.
  const { nodeCount, internalEdges, boundaryEdges } = useMemo(() => {
    const present = new Set(
      sourceTree.nodes.filter((n) => selectedNodeIds.has(n.id)).map((n) => n.id),
    );
    let internal = 0;
    let boundary = 0;
    for (const c of sourceTree.connections) {
      const p = present.has(c.parentId);
      const ch = present.has(c.childId);
      if (p && ch) internal += 1;
      else if (p || ch) boundary += 1;
    }
    return { nodeCount: present.size, internalEdges: internal, boundaryEdges: boundary };
  }, [sourceTree, selectedNodeIds]);

  const rootConflict = destTree
    ? wouldCreateRootConflict(sourceTree, selectedNodeIds, destTree)
    : false;
  const cycle = destTree
    ? wouldCreateCycle(sourceTree, selectedNodeIds, destTree.name)
    : false;

  // Defensive: Toolbar gating prevents opening with no selection or no
  // destination, but render nothing rather than show an empty modal.
  if (selectedNodeIds.size === 0 || destinations.length === 0) return null;

  const verb = mode === 'move' ? 'Moving' : 'Copying';
  const canConfirm = !!destTree && nodeCount > 0 && !rootConflict && !cycle;

  function handleConfirm(): void {
    if (!canConfirm) return;
    moveCopyToTree(destId, mode);
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="move-copy-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[min(28rem,90vw)] rounded-lg border p-5 shadow-xl"
        style={{ backgroundColor: 'var(--bt-panel-bg)', borderColor: 'var(--bt-border)' }}
      >
        <h2
          id="move-copy-title"
          className="text-base font-semibold"
          style={{ color: 'var(--bt-text-primary)' }}
        >
          Move or copy selection
        </h2>

        <label
          className="mt-4 block text-xs font-medium uppercase tracking-wide"
          style={{ color: 'var(--bt-text-secondary)' }}
        >
          Destination tree
          <select
            value={destId}
            onChange={(e) => setDestId(e.target.value)}
            aria-label="Destination tree"
            className="mt-1 w-full rounded-lg border px-2 py-1 text-sm normal-case tracking-normal focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            style={{
              borderColor: 'var(--bt-border)',
              backgroundColor: 'var(--bt-panel-bg)',
              color: 'var(--bt-text-primary)',
            }}
          >
            {destinations.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="mt-4">
          <legend
            className="text-xs font-medium uppercase tracking-wide"
            style={{ color: 'var(--bt-text-secondary)' }}
          >
            Action
          </legend>
          <div
            className="mt-1.5 inline-flex rounded-lg border p-0.5"
            style={{ borderColor: 'var(--bt-border)' }}
            role="radiogroup"
            aria-label="Action"
          >
            {MODES.map((m) => {
              const selected = mode === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setMode(m.value)}
                  className="rounded-md px-3 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-500"
                  style={
                    selected
                      ? { backgroundColor: 'var(--bt-accent, #0284c7)', color: '#ffffff' }
                      : { color: 'var(--bt-text-secondary)' }
                  }
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <p className="mt-4 text-sm" style={{ color: 'var(--bt-text-secondary)' }}>
          {verb} {nodeCount} node{nodeCount === 1 ? '' : 's'} and {internalEdges} edge
          {internalEdges === 1 ? '' : 's'}
          {boundaryEdges > 0 && (
            <>
              . {boundaryEdges} boundary edge{boundaryEdges === 1 ? '' : 's'} will be
              dropped
            </>
          )}
          .
        </p>

        {rootConflict && (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
          >
            Selection includes a Root node, and “{destTree?.name}” already has one.
          </p>
        )}
        {cycle && (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
          >
            A selected SubTree references “{destTree?.name}” — that would create a cycle.
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700 hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-900/50"
          >
            {mode === 'move' ? 'Move' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}
