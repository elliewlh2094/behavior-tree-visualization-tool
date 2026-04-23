import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { NodeKind } from '../../core/model/node';
import { NODE_HEIGHT, NODE_WIDTH } from '../../core/config/grid';
import { KIND_VISUALS } from './kind-visuals';

export interface BTNodeData extends Record<string, unknown> {
  kind: NodeKind;
  name: string;
}

export function BTNode({ data, selected }: NodeProps) {
  const { kind, name } = data as BTNodeData;
  const label = name || kind;
  const isRoot = kind === 'Root';
  const v = KIND_VISUALS[kind];
  const borderStyle = v.dashed ? 'border-dashed' : '';
  const borderClass = selected
    ? `border-2 ${v.borderSelected} ring-2 ${v.ring} ${borderStyle}`
    : `border ${v.border} ${borderStyle}`;

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-md ${borderClass} ${v.bg} px-3 shadow-sm text-sm text-slate-900 overflow-hidden`}
      style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
    >
      {!isRoot && <Handle type="target" position={Position.Top} />}
      <div className="w-full truncate text-center font-medium">{label}</div>
      <div
        className={`mt-1 inline-flex items-center gap-1 rounded-full ${v.accentBg} ${v.accent} px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide`}
      >
        <v.Icon />
        {kind}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
