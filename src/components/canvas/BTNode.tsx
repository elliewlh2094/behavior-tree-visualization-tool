import type { CSSProperties } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { NodeKind } from '../../core/model/node';
import { NODE_HEIGHT, NODE_WIDTH } from '../../core/config/grid';
import { KIND_VISUALS } from './kind-visuals';
import { nodeVar } from './color-families';
import { useBTStore } from '../../store/bt-store';

export interface BTNodeData extends Record<string, unknown> {
  kind: NodeKind;
  name: string;
}

const LEAF_KINDS: ReadonlySet<NodeKind> = new Set(['Action', 'Condition', 'SubTree']);

export function BTNode({ data, selected }: NodeProps) {
  const { kind, name } = data as BTNodeData;
  const label = name || kind;
  const isRoot = kind === 'Root';
  const isLeaf = LEAF_KINDS.has(kind);
  const v = KIND_VISUALS[kind];
  // During image export the selection ring is an editor-only affordance that
  // shouldn't bleed into the PNG. Suppress it (node + border stay) so a
  // selected node doesn't ship a glowing overlay in the exported image.
  const exporting = useBTStore((s) => s.exportInProgress) !== null;

  // Selected nodes use a thicker resting border (border-2) and the
  // *selected* color shade so the selection state stays visually distinct
  // even when the user switches the kind to a low-contrast family.
  const wrapperStyle: CSSProperties = {
    width: NODE_WIDTH,
    // Floor at NODE_HEIGHT (one line); a two-line wrapped label grows the
    // node by one grid row to ~100px. line-clamp-2 caps it there.
    minHeight: NODE_HEIGHT,
    backgroundColor: `var(${nodeVar('bg', kind)})`,
    borderStyle: v.dashed ? 'dashed' : 'solid',
    borderWidth: selected ? 2 : 1,
    borderColor: selected
      ? `var(${nodeVar('borderSelected', kind)})`
      : `var(${nodeVar('border', kind)})`,
  };
  const ringStyle: CSSProperties | undefined =
    selected && !exporting
      ? {
          boxShadow: `0 0 0 2px var(${nodeVar('ring', kind)})`,
        }
      : undefined;

  const accentStyle: CSSProperties = {
    color: `var(${nodeVar('accent', kind)})`,
    backgroundColor: `var(${nodeVar('accentBg', kind)})`,
  };

  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg px-3 shadow-subtle text-sm overflow-hidden"
      style={{ ...wrapperStyle, ...ringStyle }}
    >
      {!isRoot && <Handle type="target" position={Position.Top} />}
      <div className="w-full line-clamp-2 break-words text-center font-medium" style={{ color: 'var(--bt-text-primary)' }}>
        {label}
      </div>
      <div
        className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
        style={accentStyle}
      >
        <v.Icon />
        {kind}
      </div>
      {!isLeaf && <Handle type="source" position={Position.Bottom} />}
    </div>
  );
}
