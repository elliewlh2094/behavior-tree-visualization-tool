import { beforeEach, describe, expect, it } from 'vitest';
import type { BTDocument, BTTreeDef } from '../../../src/core/model/node';
import {
  DEFAULT_VIEWPORT,
  EMPTY_SELECTION,
  HISTORY_CAPACITY,
  selectActiveTree,
  selectViewport,
  useBTStore,
  type DocSnapshot,
} from '../../../src/store/bt-store';
import { createRingBuffer } from '../../../src/core/history/ring-buffer';

function makeRootTree(id: string, name: string): BTTreeDef {
  const rootId = `${id}-root`;
  return {
    id,
    name,
    rootId,
    nodes: [
      { id: rootId, kind: 'Root', name: '', position: { x: 0, y: 0 }, properties: {} },
    ],
    connections: [],
  };
}

function installMultiTree(): { mainId: string; otherId: string } {
  const main = makeRootTree('main', 'Main');
  const other = makeRootTree('other', 'Other');
  const document: BTDocument = {
    version: 2,
    mainTreeId: 'main',
    trees: [main, other],
  };
  useBTStore.setState({
    document,
    activeTreeId: 'main',
    selection: EMPTY_SELECTION,
    undoStack: createRingBuffer<DocSnapshot>(HISTORY_CAPACITY),
    redoStack: createRingBuffer<DocSnapshot>(HISTORY_CAPACITY),
    viewportByTreeId: {},
  });
  return { mainId: 'main', otherId: 'other' };
}

describe('bt-store multi-tree state (v1.7.1)', () => {
  beforeEach(installMultiTree);

  describe('unified history isolates per-tree content correctly', () => {
    // History is doc-level (v1.7.1) but a per-tree edit only mutates that
    // tree, so undo restores only that tree's content even though the
    // snapshot captured the whole doc.

    it('addNode pushes one snapshot to the unified undoStack', () => {
      useBTStore.getState().addNode('Sequence', { x: 0, y: 0 });
      expect(useBTStore.getState().undoStack.items.length).toBe(1);
    });

    it('two edits on different tabs each produce one snapshot', () => {
      useBTStore.getState().addNode('Sequence', { x: 0, y: 0 });
      useBTStore.getState().setActiveTreeId('other');
      useBTStore.getState().addNode('Action', { x: 0, y: 0 });
      expect(useBTStore.getState().undoStack.items.length).toBe(2);
    });

    it("undo on tab B does not affect tab A's content (most-recent edit was on B)", () => {
      // Edit Main
      useBTStore.getState().addNode('Sequence', { x: 0, y: 0 });
      const mainAfterEdit = selectActiveTree(useBTStore.getState());
      expect(mainAfterEdit.nodes).toHaveLength(2);

      // Switch to Other and add a node
      useBTStore.getState().setActiveTreeId('other');
      useBTStore.getState().addNode('Action', { x: 0, y: 0 });

      // Undo (most-recent action was on Other) → Other's node disappears
      useBTStore.getState().undo();
      const otherAfterUndo = selectActiveTree(useBTStore.getState());
      expect(otherAfterUndo.nodes).toHaveLength(1);

      // Switch back to Main → still has the Sequence
      useBTStore.getState().setActiveTreeId('main');
      const mainStill = selectActiveTree(useBTStore.getState());
      expect(mainStill.nodes).toHaveLength(2);
    });

    it('undo with empty history is a no-op regardless of active tab', () => {
      useBTStore.getState().setActiveTreeId('other');
      const before = selectActiveTree(useBTStore.getState());
      useBTStore.getState().undo();
      const after = selectActiveTree(useBTStore.getState());
      expect(after).toBe(before);
    });

    it('setDocument clears unified history and viewport', () => {
      // Seed history on both trees + viewport on one
      useBTStore.getState().addNode('Sequence', { x: 0, y: 0 });
      useBTStore.getState().setViewport('main', { x: 100, y: 200, zoom: 1.5 });
      useBTStore.getState().setActiveTreeId('other');
      useBTStore.getState().addNode('Action', { x: 0, y: 0 });

      // Replace document
      useBTStore.getState().setDocument({
        version: 2,
        mainTreeId: 'fresh',
        trees: [makeRootTree('fresh', 'Fresh')],
      });

      const state = useBTStore.getState();
      expect(state.undoStack.items).toEqual([]);
      expect(state.redoStack.items).toEqual([]);
      expect(state.viewportByTreeId).toEqual({});
    });
  });

  describe('per-tree viewport', () => {
    it('setViewport stores per tree id', () => {
      useBTStore.getState().setViewport('main', { x: 50, y: 60, zoom: 1.25 });
      useBTStore.getState().setViewport('other', { x: -10, y: -20, zoom: 0.75 });

      const { viewportByTreeId } = useBTStore.getState();
      expect(viewportByTreeId['main']).toEqual({ x: 50, y: 60, zoom: 1.25 });
      expect(viewportByTreeId['other']).toEqual({ x: -10, y: -20, zoom: 0.75 });
    });

    it('selectViewport returns DEFAULT_VIEWPORT for never-visited tabs', () => {
      const vp = selectViewport(useBTStore.getState(), 'never-visited');
      expect(vp).toEqual(DEFAULT_VIEWPORT);
    });

    it('selectViewport returns the stored viewport when present', () => {
      useBTStore.getState().setViewport('main', { x: 7, y: 8, zoom: 2 });
      expect(selectViewport(useBTStore.getState(), 'main')).toEqual({ x: 7, y: 8, zoom: 2 });
    });
  });

  describe('removeTreeStateFor', () => {
    it('removes the tree\'s viewport entry (history is no longer per-tree in v1.7.1)', () => {
      useBTStore.getState().setViewport('main', { x: 1, y: 2, zoom: 1 });
      useBTStore.getState().setViewport('other', { x: 3, y: 4, zoom: 1 });

      useBTStore.getState().removeTreeStateFor('main');

      const state = useBTStore.getState();
      expect(state.viewportByTreeId['main']).toBeUndefined();
      // Other tree is unaffected
      expect(state.viewportByTreeId['other']).toEqual({ x: 3, y: 4, zoom: 1 });
    });

    it('is a safe no-op for an unknown tree id', () => {
      useBTStore.getState().setViewport('main', { x: 1, y: 2, zoom: 1 });
      const before = useBTStore.getState();
      useBTStore.getState().removeTreeStateFor('nonexistent');
      const after = useBTStore.getState();
      expect(after.viewportByTreeId).toEqual(before.viewportByTreeId);
    });
  });
});
