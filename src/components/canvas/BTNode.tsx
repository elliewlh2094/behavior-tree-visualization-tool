import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { NodeKind } from '../../core/model/node';
import { NODE_HEIGHT, NODE_WIDTH } from '../../core/config/grid';

export interface BTNodeData extends Record<string, unknown> {
  kind: NodeKind;
  name: string;
}

export function BTNode({ data, selected }: NodeProps) {
  const { kind, name } = data as BTNodeData;
  const label = name || kind;
  const isRoot = kind === 'Root';
  const borderClass = selected
    ? 'border-2 border-sky-500 ring-2 ring-sky-200'
    : 'border border-slate-300';

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-md ${borderClass} bg-white px-3 shadow-sm text-sm text-slate-900 overflow-hidden`}
      style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
    >
      {!isRoot && <Handle type="target" position={Position.Top} />}
      <div className="w-full truncate text-center font-medium">{label}</div>
      <div className="text-xs text-slate-500">{kind}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
