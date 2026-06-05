import { describe, expect, it } from 'vitest';
import { getNodesBounds, type Node } from '@xyflow/react';

// useExportImage frames the PNG from getNodesBounds(getNodes()). This pins the
// bounding-box math the export relies on: the box must span every node
// (including ones at negative coordinates), not just the first or the visible
// viewport (AC1.9).
describe('getNodesBounds (export framing)', () => {
  it('spans all three nodes including negative offsets', () => {
    const nodes: Node[] = [
      { id: 'a', position: { x: 0, y: 0 }, data: {}, measured: { width: 100, height: 50 } },
      { id: 'b', position: { x: 200, y: 100 }, data: {}, measured: { width: 100, height: 50 } },
      { id: 'c', position: { x: -50, y: 300 }, data: {}, measured: { width: 100, height: 50 } },
    ];

    const bounds = getNodesBounds(nodes);

    expect(bounds.x).toBe(-50);
    expect(bounds.y).toBe(0);
    expect(bounds.width).toBe(350); // from x=-50 to right edge of b (300)
    expect(bounds.height).toBe(350); // from y=0 to bottom edge of c (350)
  });
});
