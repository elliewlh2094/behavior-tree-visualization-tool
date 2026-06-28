import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LandingPage } from '../../../src/components/landing/LandingPage';
import { useBTStore } from '../../../src/store/bt-store';
import { createEmptyDocument } from '../../../src/core/model/tree';

function renderLanding() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );
}

// Point document and lastSavedDocument at distinct refs so the store-level
// dirty subscription marks the document dirty (the same path a real edit takes).
function makeDirty(fileName: string) {
  const doc = createEmptyDocument();
  useBTStore.setState({
    document: doc,
    activeTreeId: doc.mainTreeId,
    fileName,
    lastSavedDocument: createEmptyDocument(),
  });
  return doc;
}

describe('LandingPage entry actions (FR8)', () => {
  beforeEach(() => {
    const doc = createEmptyDocument();
    useBTStore.setState({
      document: doc,
      activeTreeId: doc.mainTreeId,
      fileName: 'Untitled.json',
      lastSavedDocument: doc,
      dirty: false,
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('"Go to Editor" resets to a fresh blank Untitled.json', () => {
    useBTStore.setState({ fileName: 'work.json' });
    const before = useBTStore.getState().document;
    renderLanding();

    fireEvent.click(screen.getByRole('button', { name: /go to editor/i }));

    const state = useBTStore.getState();
    expect(state.document).not.toBe(before);
    expect(state.fileName).toBe('Untitled.json');
    expect(state.document.trees).toHaveLength(1);
    const tree = state.document.trees[0]!;
    expect(tree.nodes).toHaveLength(1);
    expect(tree.nodes[0]!.kind).toBe('Root');
  });

  it('"Go to Editor" while dirty resets without prompting (the guard lives at the editor exit, not here)', () => {
    const current = makeDirty('work.json');
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderLanding();

    fireEvent.click(screen.getByRole('button', { name: /go to editor/i }));

    const state = useBTStore.getState();
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(state.document).not.toBe(current);
    expect(state.fileName).toBe('Untitled.json');
  });

  it('a template card loads its tree (no prompt here either)', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderLanding();

    fireEvent.click(screen.getByRole('button', { name: /pursue a visible target/i }));

    const state = useBTStore.getState();
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(state.fileName).toBe('Chase.json');
    expect(state.document.trees.some((t) => t.name === 'Chase')).toBe(true);
  });
});
