import type { CSSProperties } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { NodeKind } from '../../core/model/node';
import { NODE_HEIGHT, NODE_WIDTH } from '../../core/config/grid';
import { KIND_VISUALS } from './kind-visuals';
import { nodeVar } from './color-families';

export interface BTNodeData extends Record<string, unknown> {
  kind: NodeKind;
  name: string;
}

const LEAF_KINDS: ReadonlySet<NodeKind> = new Set(['Action', 'Condition']);

export function BTNode({ data, selected }: NodeProps) {
  const { kind, name } = data as BTNodeData;
  const label = name || kind;
  const isRoot = kind === 'Root';
  const isLeaf = LEAF_KINDS.has(kind);
  const v = KIND_VISUALS[kind];

  // Selected nodes use a thicker resting border (border-2) and the
  // *selected* color shade so the selection state stays visually distinct
  // even when the user switches the kind to a low-contrast family.
  const wrapperStyle: CSSProperties = {
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    backgroundColor: `var(${nodeVar('bg', kind)})`,
    borderStyle: v.dashed ? 'dashed' : 'solid',
    borderWidth: selected ? 2 : 1,
    borderColor: selected
      ? `var(${nodeVar('borderSelected', kind)})`
      : `var(${nodeVar('border', kind)})`,
  };
  const ringStyle: CSSProperties | undefined = selected
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
      <div className="w-full truncate text-center font-medium" style={{ color: 'var(--bt-text-primary)' }}>
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
