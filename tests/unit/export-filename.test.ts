import { describe, expect, it } from 'vitest';
import { ensurePngExtension } from '../../src/components/export/export-filename';

describe('ensurePngExtension (AC1.4)', () => {
  it('appends .png when missing', () => {
    expect(ensurePngExtension('MyTree')).toBe('MyTree.png');
  });

  it('leaves an existing lowercase .png alone', () => {
    expect(ensurePngExtension('MyTree.png')).toBe('MyTree.png');
  });

  it('treats .PNG as a different extension and appends (case-sensitive)', () => {
    // Spec §106 / todo T4 expected output. Deliberately case-sensitive:
    // only a lowercase `.png` counts as already-suffixed.
    expect(ensurePngExtension('MyTree.PNG')).toBe('MyTree.PNG.png');
  });

  it('handles names with dots in the stem', () => {
    expect(ensurePngExtension('v1.2.tree')).toBe('v1.2.tree.png');
  });
});
