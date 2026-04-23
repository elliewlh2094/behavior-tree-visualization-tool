import { describe, expect, it } from 'vitest';
import {
  clear,
  createRingBuffer,
  isEmpty,
  peek,
  pop,
  push,
  size,
} from '../../../../src/core/history/ring-buffer';

describe('createRingBuffer', () => {
  it('creates an empty buffer with the given capacity', () => {
    const buf = createRingBuffer<number>(3);
    expect(buf.capacity).toBe(3);
    expect(size(buf)).toBe(0);
    expect(isEmpty(buf)).toBe(true);
  });

  it('rejects non-positive or non-integer capacity', () => {
    expect(() => createRingBuffer<number>(0)).toThrow();
    expect(() => createRingBuffer<number>(-1)).toThrow();
    expect(() => createRingBuffer<number>(1.5)).toThrow();
    expect(() => createRingBuffer<number>(Number.NaN)).toThrow();
  });
});

describe('push', () => {
  it('appends below capacity without eviction', () => {
    let buf = createRingBuffer<number>(3);
    buf = push(buf, 1);
    buf = push(buf, 2);
    buf = push(buf, 3);
    expect(buf.items).toEqual([1, 2, 3]);
    expect(size(buf)).toBe(3);
  });

  it('evicts the oldest item when at capacity', () => {
    let buf = createRingBuffer<number>(3);
    buf = push(buf, 1);
    buf = push(buf, 2);
    buf = push(buf, 3);
    buf = push(buf, 4);
    expect(buf.items).toEqual([2, 3, 4]);
    expect(size(buf)).toBe(3);
  });

  it('keeps evicting oldest on repeated overflow', () => {
    let buf = createRingBuffer<number>(2);
    [1, 2, 3, 4, 5].forEach((n) => {
      buf = push(buf, n);
    });
    expect(buf.items).toEqual([4, 5]);
  });

  it('does not mutate the input buffer', () => {
    const original = createRingBuffer<number>(3);
    const next = push(original, 42);
    expect(original.items).toEqual([]);
    expect(next.items).toEqual([42]);
  });
});

describe('peek', () => {
  it('returns the most recently pushed item', () => {
    let buf = createRingBuffer<number>(3);
    buf = push(buf, 1);
    buf = push(buf, 2);
    expect(peek(buf)).toBe(2);
  });

  it('returns undefined on empty', () => {
    const buf = createRingBuffer<number>(3);
    expect(peek(buf)).toBeUndefined();
  });

  it('does not mutate', () => {
    let buf = createRingBuffer<number>(3);
    buf = push(buf, 1);
    peek(buf);
    expect(buf.items).toEqual([1]);
  });
});

describe('pop', () => {
  it('removes and returns the most recently pushed item', () => {
    let buf = createRingBuffer<number>(3);
    buf = push(buf, 1);
    buf = push(buf, 2);
    const result = pop(buf);
    expect(result.item).toBe(2);
    expect(result.buf.items).toEqual([1]);
  });

  it('returns undefined item on empty and leaves the buffer alone', () => {
    const buf = createRingBuffer<number>(3);
    const result = pop(buf);
    expect(result.item).toBeUndefined();
    expect(result.buf).toBe(buf);
  });

  it('does not mutate the input', () => {
    let buf = createRingBuffer<number>(3);
    buf = push(buf, 1);
    buf = push(buf, 2);
    pop(buf);
    expect(buf.items).toEqual([1, 2]);
  });

  it('push→pop→push round-trip preserves order', () => {
    let buf = createRingBuffer<number>(3);
    buf = push(buf, 1);
    buf = push(buf, 2);
    const popped = pop(buf);
    expect(popped.item).toBe(2);
    const after = push(popped.buf, 3);
    expect(after.items).toEqual([1, 3]);
  });
});

describe('clear', () => {
  it('returns an empty buffer with the same capacity', () => {
    let buf = createRingBuffer<number>(3);
    buf = push(buf, 1);
    buf = push(buf, 2);
    const cleared = clear(buf);
    expect(cleared.items).toEqual([]);
    expect(cleared.capacity).toBe(3);
  });

  it('returns the same reference when already empty', () => {
    const buf = createRingBuffer<number>(3);
    expect(clear(buf)).toBe(buf);
  });

  it('does not mutate the input', () => {
    let buf = createRingBuffer<number>(3);
    buf = push(buf, 1);
    clear(buf);
    expect(buf.items).toEqual([1]);
  });
});
