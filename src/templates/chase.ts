import type { BTDocument } from '../core/model/node';
import { serialize } from '../core/serialization/serialize';

/**
 * Chase：追逐看得見的目標，否則改為巡邏。
 *
 * 展示 Fallback 優先順序樹（Condition + Action 葉節點），以及主打的
 * SubTree 組合：優先度較低的分支是一個 SubTree 節點，參照一併打包的
 * "Patrol" 樹。Patrol 樹放在同一份文件中，讓 `treeRef: 'Patrol'` 能被解析
 * （驗證規則 R9）。依 SubTree 身分模型，SubTree 節點的顯示名稱等於
 * 被參照的樹名稱（"Patrol"）。
 */
const document: BTDocument = {
  version: 2,
  mainTreeId: 'chase-tree',
  trees: [
    {
      id: 'chase-tree',
      name: 'Chase',
      rootId: 'chase-root',
      nodes: [
        { id: 'chase-root', kind: 'Root', name: 'Root', position: { x: 600, y: 40 }, properties: {} },
        { id: 'chase-fb', kind: 'Fallback', name: 'Chase or give up', position: { x: 600, y: 180 }, properties: {} },
        { id: 'chase-seq', kind: 'Sequence', name: 'Pursue target', position: { x: 380, y: 320 }, properties: {} },
        { id: 'chase-visible', kind: 'Condition', name: 'Target visible?', position: { x: 110, y: 460 }, properties: {} },
        { id: 'chase-move', kind: 'Action', name: 'Move toward target', position: { x: 290, y: 460 }, properties: {} },
        { id: 'chase-range', kind: 'Condition', name: 'In attack range?', position: { x: 470, y: 460 }, properties: {} },
        { id: 'chase-attack', kind: 'Action', name: 'Attack', position: { x: 650, y: 460 }, properties: {} },
        { id: 'chase-patrol', kind: 'SubTree', name: 'Patrol', position: { x: 820, y: 320 }, properties: {}, treeRef: 'Patrol' },
      ],
      connections: [
        { id: 'chase-c0', parentId: 'chase-root', childId: 'chase-fb', order: 0 },
        { id: 'chase-c1', parentId: 'chase-fb', childId: 'chase-seq', order: 0 },
        { id: 'chase-c2', parentId: 'chase-fb', childId: 'chase-patrol', order: 1 },
        { id: 'chase-c3', parentId: 'chase-seq', childId: 'chase-visible', order: 0 },
        { id: 'chase-c4', parentId: 'chase-seq', childId: 'chase-move', order: 1 },
        { id: 'chase-c5', parentId: 'chase-seq', childId: 'chase-range', order: 2 },
        { id: 'chase-c6', parentId: 'chase-seq', childId: 'chase-attack', order: 3 },
      ],
    },
    {
      id: 'patrol-tree',
      name: 'Patrol',
      rootId: 'patrol-root',
      nodes: [
        { id: 'patrol-root', kind: 'Root', name: 'Root', position: { x: 360, y: 40 }, properties: {} },
        { id: 'patrol-repeat', kind: 'Decorator', name: 'Repeat', position: { x: 360, y: 180 }, properties: {} },
        { id: 'patrol-seq', kind: 'Sequence', name: 'Patrol cycle', position: { x: 360, y: 320 }, properties: {} },
        { id: 'patrol-move-a', kind: 'Action', name: 'Move to waypoint A', position: { x: 60, y: 460 }, properties: {} },
        { id: 'patrol-wait-1', kind: 'Action', name: 'Wait and observe', position: { x: 260, y: 460 }, properties: {} },
        { id: 'patrol-move-b', kind: 'Action', name: 'Move to waypoint B', position: { x: 460, y: 460 }, properties: {} },
        { id: 'patrol-wait-2', kind: 'Action', name: 'Wait and observe', position: { x: 660, y: 460 }, properties: {} },
      ],
      connections: [
        { id: 'patrol-c0', parentId: 'patrol-root', childId: 'patrol-repeat', order: 0 },
        { id: 'patrol-c1', parentId: 'patrol-repeat', childId: 'patrol-seq', order: 0 },
        { id: 'patrol-c2', parentId: 'patrol-seq', childId: 'patrol-move-a', order: 0 },
        { id: 'patrol-c3', parentId: 'patrol-seq', childId: 'patrol-wait-1', order: 1 },
        { id: 'patrol-c4', parentId: 'patrol-seq', childId: 'patrol-move-b', order: 2 },
        { id: 'patrol-c5', parentId: 'patrol-seq', childId: 'patrol-wait-2', order: 3 },
      ],
    },
  ],
};

export const chaseTemplateJson = serialize(document);
