import { describe, expect, it } from 'vitest';
import { shortId } from '../../../../src/core/model/node';

describe('shortId', () => {
  it('returns the first 8 characters of a normal UUID', () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    expect(shortId(uuid)).toBe('a1b2c3d4');
  });

  it('returns the full string when input is <= 8 characters', () => {
    expect(shortId('abcd')).toBe('abcd');
    expect(shortId('12345678')).toBe('12345678');
  });

  it('returns an empty string for empty string input', () => {
    expect(shortId('')).toBe('');
  });
});
