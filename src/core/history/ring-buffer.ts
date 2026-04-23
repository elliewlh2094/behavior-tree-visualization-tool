export interface RingBuffer<T> {
  readonly capacity: number;
  readonly items: readonly T[];
}

export function createRingBuffer<T>(capacity: number): RingBuffer<T> {
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new Error(`ring-buffer: capacity must be a positive integer (got ${capacity})`);
  }
  return { capacity, items: [] };
}

export function size<T>(buf: RingBuffer<T>): number {
  return buf.items.length;
}

export function isEmpty<T>(buf: RingBuffer<T>): boolean {
  return buf.items.length === 0;
}

export function peek<T>(buf: RingBuffer<T>): T | undefined {
  return buf.items[buf.items.length - 1];
}

export function push<T>(buf: RingBuffer<T>, item: T): RingBuffer<T> {
  const overflow = buf.items.length >= buf.capacity;
  const base = overflow ? buf.items.slice(1) : buf.items;
  return { capacity: buf.capacity, items: [...base, item] };
}

export function pop<T>(buf: RingBuffer<T>): { buf: RingBuffer<T>; item: T | undefined } {
  if (buf.items.length === 0) {
    return { buf, item: undefined };
  }
  const item = buf.items[buf.items.length - 1]!;
  return {
    buf: { capacity: buf.capacity, items: buf.items.slice(0, -1) },
    item,
  };
}

export function clear<T>(buf: RingBuffer<T>): RingBuffer<T> {
  if (buf.items.length === 0) return buf;
  return { capacity: buf.capacity, items: [] };
}
