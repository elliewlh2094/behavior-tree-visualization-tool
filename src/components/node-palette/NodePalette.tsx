import { NODE_KINDS, type NodeKind } from '../../core/model/node';

export const PALETTE_DATA_TYPE = 'application/x-bt-kind';

const PALETTE_KINDS: readonly NodeKind[] = NODE_KINDS.filter((k) => k !== 'Root');

export function NodePalette() {
  return (
    <aside className="flex h-full w-56 flex-col gap-2 border-r border-slate-200 bg-white p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Node palette
      </h2>
      <ul className="flex flex-col gap-1">
        {PALETTE_KINDS.map((kind) => (
          <li key={kind}>
            <div
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData(PALETTE_DATA_TYPE, kind);
                event.dataTransfer.effectAllowed = 'copy';
              }}
              className="cursor-grab select-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm hover:border-slate-400 active:cursor-grabbing"
            >
              {kind}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
