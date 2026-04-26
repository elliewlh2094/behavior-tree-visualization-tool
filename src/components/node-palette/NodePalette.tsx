import { NODE_KINDS, type NodeKind } from '../../core/model/node';
import { KIND_VISUALS } from '../canvas/kind-visuals';

export const PALETTE_DATA_TYPE = 'application/x-bt-kind';

const PALETTE_KINDS: readonly NodeKind[] = NODE_KINDS.filter((k) => k !== 'Root');

export function NodePalette() {
  return (
    <aside className="flex h-full w-56 flex-col gap-2 border-r border-slate-200 bg-white p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Node palette
      </h2>
      <ul className="flex flex-col gap-1">
        {PALETTE_KINDS.map((kind) => {
          const v = KIND_VISUALS[kind];
          const borderStyle = v.dashed ? 'border-dashed' : '';
          return (
            <li key={kind}>
              <div
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData(PALETTE_DATA_TYPE, kind);
                  event.dataTransfer.effectAllowed = 'copy';
                }}
                className={`flex cursor-grab select-none items-center gap-2 rounded-lg border ${v.border} ${borderStyle} ${v.bg} px-3 py-2 text-sm text-slate-900 shadow-subtle hover:shadow-card active:cursor-grabbing`}
              >
                <span className={`inline-flex ${v.accent}`}>
                  <v.Icon />
                </span>
                <span className="font-medium">{kind}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
