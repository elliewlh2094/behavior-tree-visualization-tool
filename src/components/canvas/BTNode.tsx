import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { NodeKind } from '../../core/model/node';
import { NODE_HEIGHT, NODE_WIDTH } from '../../core/config/grid';

export interface BTNodeData extends Record<string, unknown> {
  kind: NodeKind;
  name: string;
}

export function BTNode({ data }: NodeProps) {
  const { kind, name } = data as BTNodeData;
  const label = name || kind;
  const isRoot = kind === 'Root';

  return (
    <div
      className="flex flex-col items-center justify-center rounded-md border border-slate-300 bg-white px-3 shadow-sm text-sm text-slate-900 overflow-hidden"
      style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
    >
      {!isRoot && <Handle type="target" position={Position.Top} />}
      <div className="w-full truncate text-center font-medium">{label}</div>
      <div className="text-xs text-slate-500">{kind}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
