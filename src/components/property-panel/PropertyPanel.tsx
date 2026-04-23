import { useBTStore } from '../../store/bt-store';
import { NODE_KINDS, type NodeKind } from '../../core/model/node';

const EDITABLE_KINDS: readonly NodeKind[] = NODE_KINDS.filter((k) => k !== 'Root');

export function PropertyPanel() {
  const selection = useBTStore((s) => s.selection);
  const nodes = useBTStore((s) => s.tree.nodes);
  const rootId = useBTStore((s) => s.tree.rootId);
  const updateNode = useBTStore((s) => s.updateNode);

  const selectedNode =
    selection?.type === 'node'
      ? (nodes.find((n) => n.id === selection.id) ?? null)
      : null;

  return (
    <aside className="flex h-full w-64 flex-col gap-3 border-l border-slate-200 bg-white p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Properties
      </h2>

      {!selectedNode ? (
        <p className="text-sm text-slate-500">
          Select a node to edit its properties.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Name
            </span>
            <input
              type="text"
              value={selectedNode.name}
              onChange={(e) => updateNode(selectedNode.id, { name: e.target.value })}
              className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              placeholder={selectedNode.kind}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-700">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Kind
            </span>
            <select
              value={selectedNode.kind}
              disabled={selectedNode.id === rootId}
              onChange={(e) =>
                updateNode(selectedNode.id, { kind: e.target.value as NodeKind })
              }
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
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

          <p className="text-xs text-slate-400">ID: {selectedNode.id.slice(0, 8)}…</p>
        </div>
      )}
    </aside>
  );
}
