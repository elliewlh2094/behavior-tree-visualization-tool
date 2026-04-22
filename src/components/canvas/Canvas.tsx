import { useMemo } from 'react';
import {
  Background,
  Controls,
  ReactFlow,
  type Edge,
  type Node,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useBTStore } from '../../store/bt-store';
import { BTNode, type BTNodeData } from './BTNode';

const nodeTypes: NodeTypes = { bt: BTNode };

export function Canvas() {
  const tree = useBTStore((s) => s.tree);

  const nodes = useMemo<Node<BTNodeData>[]>(
    () =>
      tree.nodes.map((n) => ({
        id: n.id,
        type: 'bt',
        position: n.position,
        data: { kind: n.kind, name: n.name },
      })),
    [tree.nodes],
  );

  const edges = useMemo<Edge[]>(
    () =>
      tree.connections.map((c) => ({
        id: c.id,
        source: c.parentId,
        target: c.childId,
      })),
    [tree.connections],
  );

  return (
    <div className="h-screen w-screen">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
