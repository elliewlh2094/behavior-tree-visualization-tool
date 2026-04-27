import type { CSSProperties } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { NodeKind } from '../../core/model/node';
import { NODE_HEIGHT, NODE_WIDTH } from '../../core/config/grid';
import { KIND_VISUALS } from './kind-visuals';

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
  const borderStyle = v.dashed ? 'border-dashed' : '';
  // Selected nodes keep a fixed 2px border (Tailwind `border-2`) so the
  // selection state stays visually unambiguous regardless of the user's
  // preferred resting border thickness; only unselected nodes pick up the
  // var-driven width.
  const borderClass = selected
    ? `border-2 ${v.borderSelected} ring-2 ${v.ring} ${borderStyle}`
    : `${v.border} ${borderStyle}`;
  const style: CSSProperties = {
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    backgroundColor: `var(${v.bgVar})`,
  };
  if (!selected) {
    style.borderWidth = 'var(--bt-node-border-thickness)';
    style.borderStyle = v.dashed ? 'dashed' : 'solid';
  }

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg ${borderClass} px-3 shadow-subtle text-sm text-slate-900 overflow-hidden`}
      style={style}
    >
      {!isRoot && <Handle type="target" position={Position.Top} />}
      <div className="w-full truncate text-center font-medium">{label}</div>
      <div
        className={`mt-1 inline-flex items-center gap-1 rounded-full ${v.accentBg} ${v.accent} px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide`}
      >
        <v.Icon />
        {kind}
      </div>
      {!isLeaf && <Handle type="source" position={Position.Bottom} />}
    </div>
  );
}
