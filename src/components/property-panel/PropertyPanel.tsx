import { useRef } from 'react';
import { useBTStore } from '../../store/bt-store';
import { NODE_KINDS, shortId, type BTNode, type NodeKind } from '../../core/model/node';

const EDITABLE_KINDS: readonly NodeKind[] = NODE_KINDS.filter((k) => k !== 'Root');

function formatSelectionSummary(nodeCount: number, edgeCount: number): string {
  const parts: string[] = [];
  if (nodeCount > 0) parts.push(`${nodeCount} node${nodeCount === 1 ? '' : 's'}`);
  if (edgeCount > 0) parts.push(`${edgeCount} edge${edgeCount === 1 ? '' : 's'}`);
  return `${parts.join(', ')} selected`;
}

function nodeLabel(n: BTNode): string {
  return n.name.trim() !== '' ? n.name : n.kind;
}

export function PropertyPanel() {
  const selection = useBTStore((s) => s.selection);
  const nodes = useBTStore((s) => s.tree.nodes);
  const connections = useBTStore((s) => s.tree.connections);
  const rootId = useBTStore((s) => s.tree.rootId);
  const updateNodeName = useBTStore((s) => s.updateNodeName);
  const updateNodeKind = useBTStore((s) => s.updateNodeKind);
  const beginGesture = useBTStore((s) => s.beginGesture);

  // Tracks whether the current focus session has already pushed a history
  // snapshot. Snapshot fires on the first keystroke (not onFocus) so that
  // tabbing through inputs never wastes ring-buffer slots.
  const nameGestureOpen = useRef(false);

  const nodeCount = selection.nodeIds.size;
  const edgeCount = selection.edgeIds.size;
  const isSingleNode = nodeCount === 1 && edgeCount === 0;
  const isSingleEdge = nodeCount === 0 && edgeCount === 1;
  const isEmpty = nodeCount === 0 && edgeCount === 0;
  const selectedNode = isSingleNode
    ? (nodes.find((n) => selection.nodeIds.has(n.id)) ?? null)
    : null;
  const selectedEdge = isSingleEdge
    ? (connections.find((c) => selection.edgeIds.has(c.id)) ?? null)
    : null;
  const parentNode = selectedNode
    ? (() => {
        const pid = connections.find((c) => c.childId === selectedNode.id)?.parentId;
        return pid ? (nodes.find((n) => n.id === pid) ?? null) : null;
      })()
    : null;
  const childNodes: BTNode[] = selectedNode
    ? connections
        .filter((c) => c.parentId === selectedNode.id)
        .map((c) => nodes.find((n) => n.id === c.childId))
        .filter((n): n is BTNode => n != null)
    : [];
  const edgeFrom = selectedEdge ? (nodes.find((n) => n.id === selectedEdge.parentId) ?? null) : null;
  const edgeTo = selectedEdge ? (nodes.find((n) => n.id === selectedEdge.childId) ?? null) : null;

  // Renders inside Sidebar's tab body — no outer <aside> or heading; the
  // tabbed header in Sidebar provides the Properties label.
  return (
    <div className="flex flex-col gap-3 p-3">
      {isEmpty ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Select a node to edit its properties.
        </p>
      ) : selectedEdge && edgeFrom && edgeTo ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-slate-400 font-mono dark:text-slate-500">
            Edge ID: {shortId(selectedEdge.id)}…
          </p>
          <p className="text-xs text-slate-400 font-mono dark:text-slate-500">
            From: {shortId(edgeFrom.id)}… ({nodeLabel(edgeFrom)})
          </p>
          <p className="text-xs text-slate-400 font-mono dark:text-slate-500">
            To: {shortId(edgeTo.id)}… ({nodeLabel(edgeTo)})
          </p>
        </div>
      ) : !selectedNode ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {formatSelectionSummary(nodeCount, edgeCount)}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-300">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Name
            </span>
            <input
              type="text"
              value={selectedNode.name}
              onChange={(e) => {
                if (!nameGestureOpen.current) {
                  beginGesture();
                  nameGestureOpen.current = true;
                }
                updateNodeName(selectedNode.id, e.target.value);
              }}
              onBlur={() => {
                nameGestureOpen.current = false;
              }}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              placeholder={selectedNode.kind}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-300">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Kind
            </span>
            <select
              value={selectedNode.kind}
              disabled={selectedNode.id === rootId}
              onChange={(e) =>
                updateNodeKind(selectedNode.id, e.target.value as NodeKind)
              }
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
            >
              {selectedNode.id === rootId ? (
                <option value="Root">Root</option>
              ) : (
                EDITABLE_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))
              )}
            </select>
          </label>

          <p className="text-xs text-slate-400 font-mono dark:text-slate-500">ID: {shortId(selectedNode.id)}…</p>
          <p className="text-xs text-slate-400 font-mono dark:text-slate-500">
            Parent:{' '}
            {parentNode
              ? `${shortId(parentNode.id)}… (${nodeLabel(parentNode)})`
              : 'none'}
          </p>
          <p className="text-xs text-slate-400 font-mono dark:text-slate-500">
            Children:{' '}
            {childNodes.length === 0
              ? 'none'
              : childNodes
                  .map((n) => `${shortId(n.id)}… (${nodeLabel(n)})`)
                  .join(', ')}
          </p>
        </div>
      )}
    </div>
  );
}
