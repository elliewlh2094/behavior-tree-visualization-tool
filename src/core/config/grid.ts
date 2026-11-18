export const GRID_SIZE = 25;

export const NODE_WIDTH = GRID_SIZE * 6;
export const NODE_HEIGHT = GRID_SIZE * 3;
// v1.12（AD11）：符號方框（Sequence／Fallback／Parallel）與 Decorator 菱形的邊長。
export const CONTROL_NODE_SIZE = GRID_SIZE * 2;

export function snapToGrid(value: number, size: number = GRID_SIZE): number {
  return Math.round(value / size) * size;
}
