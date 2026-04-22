import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { NodeKind } from '../../core/model/node';

export interface BTNodeData extends Record<string, unknown> {
  kind: NodeKind;
  name: string;
}

export function BTNode({ data }: NodeProps) {
  const { kind, name } = data as BTNodeData;
  const label = name || kind;
  const isRoot = kind === 'Root';

  return (
    <div className="rounded-md border border-slate-300 bg-white px-3 py-2 shadow-sm text-sm text-slate-900 min-w-[8rem] text-center">
      {!isRoot && <Handle type="target" position={Position.Top} />}
      <div className="font-medium">{label}</div>
      <div className="text-xs text-slate-500">{kind}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
