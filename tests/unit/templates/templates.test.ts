import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { TEMPLATES } from '../../../src/templates';
import { deserialize } from '../../../src/core/serialization/deserialize';
import { validate } from '../../../src/core/validation';
import { useLoadTemplate } from '../../../src/hooks/useLoadTemplate';
import { useBTStore } from '../../../src/store/bt-store';

describe('bundled templates (FR8)', () => {
  it('ships Chase only (Patrol is bundled inside Chase as a SubTree)', () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(['chase']);
  });

  describe.each(TEMPLATES.map((t) => [t.id, t] as const))('%s', (_id, template) => {
    it('deserializes into a v2 document', () => {
      const result = deserialize(template.json);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.document.version).toBe(2);
    });

    it('validates with zero issues (no errors, no orphan warnings)', () => {
      const result = deserialize(template.json);
      if (!result.ok) throw new Error('template failed to deserialize');
      expect(validate(result.document)).toEqual([]);
    });
  });

  it('Chase references the bundled Patrol tree via a SubTree node (R9 clean)', () => {
    const chase = TEMPLATES.find((t) => t.id === 'chase')!;
    const result = deserialize(chase.json);
    if (!result.ok) throw new Error('chase failed to deserialize');
    const treeNames = result.document.trees.map((t) => t.name);
    expect(treeNames).toContain('Patrol');
    const subTree = result.document.trees
      .flatMap((t) => t.nodes)
      .find((n) => n.kind === 'SubTree');
    expect(subTree?.treeRef).toBe('Patrol');
  });
});

describe('useLoadTemplate (FR8)', () => {
  it('loads a template as a clean document with a name-derived file name', () => {
    const chase = TEMPLATES.find((t) => t.id === 'chase')!;
    const { result } = renderHook(() => useLoadTemplate());

    result.current(chase);

    const state = useBTStore.getState();
    expect(state.fileName).toBe('Chase.json');
    expect(state.dirty).toBe(false);
    expect(state.activeTreeId).toBe(state.document.mainTreeId);
    expect(state.document.trees.some((t) => t.name === 'Chase')).toBe(true);
  });
});
