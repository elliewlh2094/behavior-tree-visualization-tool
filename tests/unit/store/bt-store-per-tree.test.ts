import { beforeEach, describe, expect, it } from 'vitest';
import type { BTDocument, BTTreeDef } from '../../../src/core/model/node';
import {
  DEFAULT_VIEWPORT,
  EMPTY_SELECTION,
  selectActiveTree,
  selectViewport,
  useBTStore,
} from '../../../src/store/bt-store';

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
    undoStacks: {},
    redoStacks: {},
    viewportByTreeId: {},
  });
  return { mainId: 'main', otherId: 'other' };
}

describe('bt-store per-tree state (T10)', () => {
  beforeEach(installMultiTree);

  describe('per-tree history isolation', () => {
    it('addNode pushes to the active tree\'s undo stack only', () => {
      const { mainId, otherId } = { mainId: 'main', otherId: 'other' };

      // Add a node on Main
      useBTStore.getState().addNode('Sequence', { x: 0, y: 0 });
      const { undoStacks } = useBTStore.getState();
      expect(undoStacks[mainId]?.items.length).toBe(1);
      expect(undoStacks[otherId]).toBeUndefined();
    });

    it('switching tabs preserves each tree\'s undo stack', () => {
      // Edit Main
      useBTStore.getState().addNode('Sequence', { x: 0, y: 0 });
      // Switch to Other
      useBTStore.getState().setActiveTreeId('other');
      // Edit Other
      useBTStore.getState().addNode('Action', { x: 0, y: 0 });

      const { undoStacks } = useBTStore.getState();
      expect(undoStacks['main']?.items.length).toBe(1);
      expect(undoStacks['other']?.items.length).toBe(1);
    });

    it('undo on tab B does not affect tab A\'s state', () => {
      // Edit Main
      useBTStore.getState().addNode('Sequence', { x: 0, y: 0 });
      const mainAfterEdit = selectActiveTree(useBTStore.getState());
      expect(mainAfterEdit.nodes).toHaveLength(2);

      // Switch to Other and add a node
      useBTStore.getState().setActiveTreeId('other');
      useBTStore.getState().addNode('Action', { x: 0, y: 0 });

      // Undo on Other → its node disappears
      useBTStore.getState().undo();
      const otherAfterUndo = selectActiveTree(useBTStore.getState());
      expect(otherAfterUndo.nodes).toHaveLength(1);

      // Switch back to Main → still has the Sequence
      useBTStore.getState().setActiveTreeId('main');
      const mainStill = selectActiveTree(useBTStore.getState());
      expect(mainStill.nodes).toHaveLength(2);
    });

    it('undo on a tree with empty history is a no-op', () => {
      // Other tree has no edits yet
      useBTStore.getState().setActiveTreeId('other');
      const before = selectActiveTree(useBTStore.getState());
      useBTStore.getState().undo();
      const after = selectActiveTree(useBTStore.getState());
      expect(after).toBe(before);
    });

    it('setDocument resets every tree\'s history and viewport', () => {
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
      expect(state.undoStacks).toEqual({});
      expect(state.redoStacks).toEqual({});
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
    it('removes the tree\'s undo, redo, and viewport entries', () => {
      useBTStore.getState().addNode('Sequence', { x: 0, y: 0 });
      useBTStore.getState().setViewport('main', { x: 1, y: 2, zoom: 1 });
      useBTStore.getState().setActiveTreeId('other');
      useBTStore.getState().addNode('Action', { x: 0, y: 0 });
      useBTStore.getState().setViewport('other', { x: 3, y: 4, zoom: 1 });

      useBTStore.getState().removeTreeStateFor('main');

      const state = useBTStore.getState();
      expect(state.undoStacks['main']).toBeUndefined();
      expect(state.redoStacks['main']).toBeUndefined();
      expect(state.viewportByTreeId['main']).toBeUndefined();
      // Other tree is unaffected
      expect(state.undoStacks['other']).toBeDefined();
      expect(state.viewportByTreeId['other']).toEqual({ x: 3, y: 4, zoom: 1 });
    });

    it('is a safe no-op for an unknown tree id', () => {
      useBTStore.getState().addNode('Sequence', { x: 0, y: 0 });
      const before = useBTStore.getState();
      useBTStore.getState().removeTreeStateFor('nonexistent');
      const after = useBTStore.getState();
      expect(after.undoStacks).toEqual(before.undoStacks);
      expect(after.redoStacks).toEqual(before.redoStacks);
      expect(after.viewportByTreeId).toEqual(before.viewportByTreeId);
    });
  });
});
