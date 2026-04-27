import { NODE_KINDS, type NodeKind } from '../../core/model/node';
import { KIND_VISUALS } from '../canvas/kind-visuals';
import { nodeVar } from '../canvas/color-families';

export const PALETTE_DATA_TYPE = 'application/x-bt-kind';

const PALETTE_KINDS: readonly NodeKind[] = NODE_KINDS.filter((k) => k !== 'Root');

export function NodePalette() {
  return (
    <aside
      className="flex h-full w-56 flex-col gap-2 border-r p-3"
      style={{
        backgroundColor: 'var(--bt-panel-bg)',
        borderColor: 'var(--bt-border)',
      }}
    >
      <h2
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: 'var(--bt-text-secondary)' }}
      >
        Node palette
      </h2>
      <ul className="flex flex-col gap-1">
        {PALETTE_KINDS.map((kind) => {
          const v = KIND_VISUALS[kind];
          return (
            <li key={kind}>
              <div
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData(PALETTE_DATA_TYPE, kind);
                  event.dataTransfer.effectAllowed = 'copy';
                }}
                className="flex cursor-grab select-none items-center gap-2 rounded-lg px-3 py-2 text-sm shadow-subtle hover:shadow-card active:cursor-grabbing"
                style={{
                  backgroundColor: `var(${nodeVar('bg', kind)})`,
                  borderStyle: v.dashed ? 'dashed' : 'solid',
                  borderWidth: 1,
                  borderColor: `var(${nodeVar('border', kind)})`,
                  color: 'var(--bt-text-primary)',
                }}
              >
                <span
                  className="inline-flex"
                  style={{ color: `var(${nodeVar('accent', kind)})` }}
                >
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
