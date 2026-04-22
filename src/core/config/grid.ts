export const GRID_SIZE = 25;

export const NODE_WIDTH = GRID_SIZE * 6;
export const NODE_HEIGHT = GRID_SIZE * 3;

export function snapToGrid(value: number, size: number = GRID_SIZE): number {
  return Math.round(value / size) * size;
}
