// v1.7.1: unified history timeline. Replaces v1.7's dual-stack model.
// Every action that mutates the document pushes one DocSnapshot capturing
// the doc + activeTreeId before the action ran. Undo/redo pop the most
// recent snapshot and restore both fields (active tab only changes if the
// current activeTreeId is no longer present in the restored doc).
import { beforeEach, describe, expect, it } from 'vitest';
import type { BTDocument, BTNode, BTTreeDef } from '../../../src/core/model/node';
import {
  type DocSnapshot,
  EMPTY_SELECTION,
  HISTORY_CAPACITY,
  useBTStore,
} from '../../../src/store/bt-store';
import { createRingBuffer } from '../../../src/core/history/ring-buffer';

function rootNode(id: string): BTNode {
  return { id, kind: 'Root', name: 'Root', position: { x: 0, y: 0 }, properties: {} };
}

function subtreeNode(id: string, treeRef: string, name = treeRef): BTNode {
  return {
    id,
    kind: 'SubTree',
    name,
    position: { x: 0, y: 0 },
    properties: {},
    treeRef,
  };
}

function makeTree(opts: {
  id: string;
  name: string;
  extraNodes?: readonly BTNode[];
}): BTTreeDef {
  return {
    id: opts.id,
    name: opts.name,
    rootId: `${opts.id}-root`,
    nodes: [rootNode(`${opts.id}-root`), ...(opts.extraNodes ?? [])],
    connections: [],
  };
}

function install(document: BTDocument, activeTreeId: string): void {
  useBTStore.setState({
    document,
    activeTreeId,
    selection: EMPTY_SELECTION,
    undoStack: createRingBuffer<DocSnapshot>(HISTORY_CAPACITY),
    redoStack: createRingBuffer<DocSnapshot>(HISTORY_CAPACITY),
    viewportByTreeId: {},
  });
}

function getTree(treeId: string): BTTreeDef {
  return useBTStore.getState().document.trees.find((t) => t.id === treeId)!;
}

function treeIds(): string[] {
  return useBTStore.getState().document.trees.map((t) => t.id);
}

describe('unified history timeline (v1.7.1)', () => {
  describe('snapshot push semantics', () => {
    beforeEach(() => {
      install(
        {
          version: 2,
          mainTreeId: 'main',
          trees: [
            makeTree({ id: 'main', name: 'Main' }),
            makeTree({ id: 'patrol', name: 'Patrol' }),
          ],
        },
        'main',
      );
    });

    it('per-tree edit pushes one snapshot capturing the pre-action doc', () => {
      const prevDocument = useBTStore.getState().document;
      const prevActive = useBTStore.getState().activeTreeId;

      useBTStore.getState().addNode('Sequence', { x: 0, y: 0 });

      const stack = useBTStore.getState().undoStack;
      expect(stack.items).toHaveLength(1);
      expect(stack.items[0]!.document).toBe(prevDocument);
      expect(stack.items[0]!.activeTreeId).toBe(prevActive);
    });

    it('renameTree pushes one snapshot capturing the pre-action doc + active', () => {
      const prevDocument = useBTStore.getState().document;
      const prevActive = useBTStore.getState().activeTreeId;

      useBTStore.getState().renameTree('patrol', 'Guard');

      const stack = useBTStore.getState().undoStack;
      expect(stack.items).toHaveLength(1);
      expect(stack.items[0]!.document).toBe(prevDocument);
      expect(stack.items[0]!.activeTreeId).toBe(prevActive);
    });

    it('addTree pushes one snapshot capturing the pre-add active tab', () => {
      const prevDocument = useBTStore.getState().document;
      const prevActive = useBTStore.getState().activeTreeId;

      useBTStore.getState().addTree('Tree 3');

      const stack = useBTStore.getState().undoStack;
      expect(stack.items).toHaveLength(1);
      expect(stack.items[0]!.document).toBe(prevDocument);
      expect(stack.items[0]!.activeTreeId).toBe(prevActive);
      // The new tree is now active (post-action).
      expect(useBTStore.getState().activeTreeId).not.toBe(prevActive);
    });

    it('deleteTree pushes one snapshot capturing the pre-delete active', () => {
      useBTStore.getState().setActiveTreeId('patrol');
      const prevDocument = useBTStore.getState().document;

      useBTStore.getState().deleteTree('patrol');

      const stack = useBTStore.getState().undoStack;
      expect(stack.items).toHaveLength(1);
      expect(stack.items[0]!.document).toBe(prevDocument);
      expect(stack.items[0]!.activeTreeId).toBe('patrol');
      // Post-delete: active swung to main.
      expect(useBTStore.getState().activeTreeId).toBe('main');
    });

    it('no-op renameTree (newName === oldName) does not push', () => {
      useBTStore.getState().renameTree('patrol', 'Patrol');
      expect(useBTStore.getState().undoStack.items).toHaveLength(0);
    });

    it('no-op deleteTree (mainTreeId) does not push', () => {
      useBTStore.getState().deleteTree('main');
      expect(useBTStore.getState().undoStack.items).toHaveLength(0);
    });

    it('any push clears redoStack', () => {
      // Seed a redo entry by undoing a per-tree edit
      useBTStore.getState().addNode('Sequence', { x: 0, y: 0 });
      useBTStore.getState().undo();
      expect(useBTStore.getState().redoStack.items.length).toBe(1);

      // Cross-tree push must clear it
      useBTStore.getState().renameTree('patrol', 'Guard');
      expect(useBTStore.getState().redoStack.items.length).toBe(0);
    });
  });

  describe('undo / redo semantics', () => {
    beforeEach(() => {
      install(
        {
          version: 2,
          mainTreeId: 'main',
          trees: [
            makeTree({
              id: 'main',
              name: 'Main',
              extraNodes: [subtreeNode('s1', 'Patrol')],
            }),
            makeTree({ id: 'patrol', name: 'Patrol' }),
          ],
        },
        'main',
      );
    });

    it('renameTree undo restores tree name and propagates to SubTree refs', () => {
      useBTStore.getState().renameTree('patrol', 'Guard');
      expect(getTree('patrol').name).toBe('Guard');
      expect(getTree('main').nodes.find((n) => n.id === 's1')!.treeRef).toBe('Guard');

      useBTStore.getState().undo();

      expect(getTree('patrol').name).toBe('Patrol');
      expect(getTree('main').nodes.find((n) => n.id === 's1')!.treeRef).toBe('Patrol');
    });

    it('addTree undo removes the tree', () => {
      useBTStore.getState().addTree('Tree 3');
      expect(treeIds()).toHaveLength(3);

      useBTStore.getState().undo();

      expect(treeIds()).toEqual(['main', 'patrol']);
    });

    it('deleteTree undo restores the deleted tree', () => {
      useBTStore.getState().setActiveTreeId('patrol');
      useBTStore.getState().deleteTree('patrol');
      expect(treeIds()).toEqual(['main']);

      useBTStore.getState().undo();

      expect(treeIds()).toEqual(['main', 'patrol']);
    });

    it('redo replays the most recent undone action', () => {
      useBTStore.getState().addTree('Tree 3');
      useBTStore.getState().undo();
      expect(treeIds()).toHaveLength(2);

      useBTStore.getState().redo();
      expect(treeIds()).toHaveLength(3);
    });

    it('undo + redo round-trip preserves doc structural state', () => {
      useBTStore.getState().addNode('Sequence', { x: 0, y: 0 });
      useBTStore.getState().renameTree('patrol', 'Guard');
      useBTStore.getState().setActiveTreeId('patrol');
      useBTStore.getState().addNode('Action', { x: 0, y: 0 });
      const docAfter = JSON.stringify(useBTStore.getState().document);

      useBTStore.getState().undo();
      useBTStore.getState().undo();
      useBTStore.getState().undo();
      useBTStore.getState().redo();
      useBTStore.getState().redo();
      useBTStore.getState().redo();

      expect(JSON.stringify(useBTStore.getState().document)).toBe(docAfter);
    });

    it('undo / redo clear selection', () => {
      useBTStore.getState().addNode('Sequence', { x: 0, y: 0 });
      useBTStore.getState().setSelection({
        nodeIds: new Set(['some-id']),
        edgeIds: new Set(),
      });
      useBTStore.getState().undo();
      expect(useBTStore.getState().selection).toBe(EMPTY_SELECTION);

      useBTStore.getState().setSelection({
        nodeIds: new Set(['other-id']),
        edgeIds: new Set(),
      });
      useBTStore.getState().redo();
      expect(useBTStore.getState().selection).toBe(EMPTY_SELECTION);
    });

    it('undo on empty stack is a no-op', () => {
      const before = useBTStore.getState();
      useBTStore.getState().undo();
      const after = useBTStore.getState();
      expect(after.document).toBe(before.document);
      expect(after.activeTreeId).toBe(before.activeTreeId);
      expect(after.undoStack.items).toEqual([]);
      expect(after.redoStack.items).toEqual([]);
    });

    it('redo on empty stack is a no-op', () => {
      const before = useBTStore.getState();
      useBTStore.getState().redo();
      const after = useBTStore.getState();
      expect(after.document).toBe(before.document);
      expect(after.activeTreeId).toBe(before.activeTreeId);
    });
  });

  describe('active tab fallback rule', () => {
    beforeEach(() => {
      install(
        {
          version: 2,
          mainTreeId: 'main',
          trees: [
            makeTree({ id: 'main', name: 'Main' }),
            makeTree({ id: 'patrol', name: 'Patrol' }),
          ],
        },
        'main',
      );
    });

    it('keeps active tab when it still exists in the restored doc', () => {
      // Active = main. addTree makes Tree 3 active. User clicks back to main.
      useBTStore.getState().addTree('Tree 3');
      useBTStore.getState().setActiveTreeId('main');
      expect(useBTStore.getState().activeTreeId).toBe('main');

      useBTStore.getState().undo();
      // main still exists in pre-add doc → stay on main.
      expect(useBTStore.getState().activeTreeId).toBe('main');
    });

    it('falls back to snapshot active when current tab no longer exists', () => {
      // addTree makes the new tree active. User stays on it. Undo removes
      // the tab — so activeTreeId would dangle without the fallback.
      useBTStore.getState().addTree('Tree 3');
      const newId = useBTStore.getState().activeTreeId;
      expect(newId).not.toBe('main');

      useBTStore.getState().undo();
      // Falls back to snapshot's pre-add active (main).
      expect(useBTStore.getState().activeTreeId).toBe('main');
    });

    it('renameTree undo from a third tab keeps the user on the third tab', () => {
      // Add a third tree, switch to main, rename patrol, switch to the third
      // tree, undo. The user should stay on the third tree (it survives the
      // restored doc) — the rename reverts underneath without teleporting.
      useBTStore.getState().addTree('Tree 3'); // active = Tree 3
      const tree3Id = useBTStore.getState().activeTreeId;
      useBTStore.getState().setActiveTreeId('main'); // user switches to main
      useBTStore.getState().renameTree('patrol', 'Guard'); // active = main
      useBTStore.getState().setActiveTreeId(tree3Id); // user switches to Tree 3

      useBTStore.getState().undo(); // undo the rename
      // Tree 3 still exists in pre-rename doc → stay on Tree 3.
      expect(useBTStore.getState().activeTreeId).toBe(tree3Id);
      expect(getTree('patrol').name).toBe('Patrol');
    });

    it('deleteTree undo lands user on whatever tab they were on (no auto-activate)', () => {
      // User deletes patrol from patrol tab → auto-switches to main.
      useBTStore.getState().setActiveTreeId('patrol');
      useBTStore.getState().deleteTree('patrol');
      expect(useBTStore.getState().activeTreeId).toBe('main');

      useBTStore.getState().undo();
      // patrol is back in the doc. main still exists → stay on main.
      // (User can click patrol's tab to view it.)
      expect(useBTStore.getState().activeTreeId).toBe('main');
      expect(treeIds()).toEqual(['main', 'patrol']);
    });
  });

  describe('chronological order is independent of active tab', () => {
    // The user's reported v1.4-smoke scenario, regression-locked.
    // Steps: Add Tree 2 → Sequence on Main → Rename Tree 2 → Action on
    // Recon → Decorator on Main. Undo×5 should revert in exact reverse
    // order: Decorator, Action, Rename, Sequence, Tree 2.
    beforeEach(() => {
      install(
        {
          version: 2,
          mainTreeId: 'main',
          trees: [makeTree({ id: 'main', name: 'Main' })],
        },
        'main',
      );
    });

    it('user reported 5-action scenario undoes in exact reverse-chronological order', () => {
      // Step 1: Add Tree 2
      useBTStore.getState().addTree('Tree 2');
      const tree2Id = useBTStore.getState().activeTreeId;
      // Step 2: Sequence on Main
      useBTStore.getState().setActiveTreeId('main');
      useBTStore.getState().addNode('Sequence', { x: 0, y: 0 });
      // Step 3: Rename Tree 2 → Recon
      useBTStore.getState().setActiveTreeId(tree2Id);
      useBTStore.getState().renameTree(tree2Id, 'Recon');
      // Step 4: Action on Recon
      useBTStore.getState().addNode('Action', { x: 0, y: 0 });
      // Step 5: Decorator on Main
      useBTStore.getState().setActiveTreeId('main');
      useBTStore.getState().addNode('Decorator', { x: 0, y: 0 });

      const stateAfterAll = JSON.stringify(useBTStore.getState().document);

      // Undo #1: Decorator gone from Main
      useBTStore.getState().undo();
      expect(getTree('main').nodes.find((n) => n.kind === 'Decorator')).toBeUndefined();
      expect(getTree('main').nodes.find((n) => n.kind === 'Sequence')).toBeDefined();
      expect(getTree(tree2Id).name).toBe('Recon');
      expect(getTree(tree2Id).nodes.find((n) => n.kind === 'Action')).toBeDefined();

      // Undo #2: Action gone from Recon
      useBTStore.getState().undo();
      expect(getTree(tree2Id).name).toBe('Recon');
      expect(getTree(tree2Id).nodes.find((n) => n.kind === 'Action')).toBeUndefined();

      // Undo #3: Recon → Tree 2
      useBTStore.getState().undo();
      expect(getTree(tree2Id).name).toBe('Tree 2');

      // Undo #4: Sequence gone from Main
      useBTStore.getState().undo();
      expect(getTree('main').nodes.find((n) => n.kind === 'Sequence')).toBeUndefined();
      expect(treeIds()).toEqual(['main', tree2Id]);

      // Undo #5: Tree 2 disappears
      useBTStore.getState().undo();
      expect(treeIds()).toEqual(['main']);

      // Undo #6: empty stack — no-op
      const beforeNoop = useBTStore.getState();
      useBTStore.getState().undo();
      expect(useBTStore.getState().document).toBe(beforeNoop.document);
      expect(useBTStore.getState().undoStack.items).toEqual([]);

      // Redo all the way forward — should land back on the post-Step-5 state.
      for (let i = 0; i < 5; i++) useBTStore.getState().redo();
      expect(JSON.stringify(useBTStore.getState().document)).toBe(stateAfterAll);
    });

    it('switching tabs between undos does not change which action is reverted', () => {
      // Extract tree shape for parametric comparison (tree ids are uuids,
      // so the two runs will have different ids — compare by name + node
      // kinds instead).
      function shape(doc: BTDocument) {
        return doc.trees.map((t) => ({
          name: t.name,
          nodeKinds: t.nodes.map((n) => n.kind).sort(),
        }));
      }

      // Run A: stay on the originally-active tab throughout.
      useBTStore.getState().addTree('Tree 2');
      const tree2IdA = useBTStore.getState().activeTreeId;
      useBTStore.getState().setActiveTreeId('main');
      useBTStore.getState().addNode('Sequence', { x: 0, y: 0 });
      useBTStore.getState().setActiveTreeId(tree2IdA);
      useBTStore.getState().renameTree(tree2IdA, 'Recon');
      useBTStore.getState().addNode('Action', { x: 0, y: 0 });
      useBTStore.getState().setActiveTreeId('main');
      useBTStore.getState().addNode('Decorator', { x: 0, y: 0 });

      const shapesA: ReturnType<typeof shape>[] = [];
      for (let i = 0; i < 5; i++) {
        useBTStore.getState().undo();
        shapesA.push(shape(useBTStore.getState().document));
      }

      // Run B: same scenario, but switch tabs before each undo.
      install(
        {
          version: 2,
          mainTreeId: 'main',
          trees: [makeTree({ id: 'main', name: 'Main' })],
        },
        'main',
      );
      useBTStore.getState().addTree('Tree 2');
      const tree2IdB = useBTStore.getState().activeTreeId;
      useBTStore.getState().setActiveTreeId('main');
      useBTStore.getState().addNode('Sequence', { x: 0, y: 0 });
      useBTStore.getState().setActiveTreeId(tree2IdB);
      useBTStore.getState().renameTree(tree2IdB, 'Recon');
      useBTStore.getState().addNode('Action', { x: 0, y: 0 });
      useBTStore.getState().setActiveTreeId('main');
      useBTStore.getState().addNode('Decorator', { x: 0, y: 0 });

      const targets = ['main', tree2IdB, 'main', tree2IdB, 'main'];
      const shapesB: ReturnType<typeof shape>[] = [];
      for (let i = 0; i < 5; i++) {
        const target = targets[i]!;
        if (useBTStore.getState().document.trees.some((t) => t.id === target)) {
          useBTStore.getState().setActiveTreeId(target);
        }
        useBTStore.getState().undo();
        shapesB.push(shape(useBTStore.getState().document));
      }

      // Document shape at every step is identical despite tab-switching.
      for (let i = 0; i < 5; i++) {
        expect(shapesA[i]).toEqual(shapesB[i]);
      }
    });

    it('redo replays in chronological order regardless of active tab', () => {
      // Build the scenario, undo to empty, then redo with tab-switching.
      useBTStore.getState().addTree('Tree 2');
      const tree2Id = useBTStore.getState().activeTreeId;
      useBTStore.getState().setActiveTreeId('main');
      useBTStore.getState().addNode('Sequence', { x: 0, y: 0 });
      useBTStore.getState().setActiveTreeId(tree2Id);
      useBTStore.getState().renameTree(tree2Id, 'Recon');
      useBTStore.getState().addNode('Action', { x: 0, y: 0 });
      useBTStore.getState().setActiveTreeId('main');
      useBTStore.getState().addNode('Decorator', { x: 0, y: 0 });

      const docFinal = JSON.stringify(useBTStore.getState().document);

      // Undo to empty.
      for (let i = 0; i < 5; i++) useBTStore.getState().undo();

      // Redo with arbitrary tab switching — must replay original order.
      const targets = ['main', 'main', 'main', 'main', 'main']; // only main exists initially
      for (let i = 0; i < 5; i++) {
        const target = targets[i]!;
        if (useBTStore.getState().document.trees.some((t) => t.id === target)) {
          useBTStore.getState().setActiveTreeId(target);
        }
        useBTStore.getState().redo();
      }

      expect(JSON.stringify(useBTStore.getState().document)).toBe(docFinal);
    });
  });

  describe('eviction at HISTORY_CAPACITY', () => {
    beforeEach(() => {
      install(
        {
          version: 2,
          mainTreeId: 'main',
          trees: [makeTree({ id: 'main', name: 'Main' })],
        },
        'main',
      );
    });

    it('caps undoStack at HISTORY_CAPACITY; oldest snapshot evicted', () => {
      for (let i = 0; i < HISTORY_CAPACITY + 3; i++) {
        useBTStore.getState().addNode('Sequence', { x: i, y: i });
      }
      expect(useBTStore.getState().undoStack.items).toHaveLength(HISTORY_CAPACITY);

      // Undo HISTORY_CAPACITY times exhausts the stack.
      for (let i = 0; i < HISTORY_CAPACITY; i++) {
        useBTStore.getState().undo();
      }
      expect(useBTStore.getState().undoStack.items).toEqual([]);
      // One more undo is a no-op (stack empty).
      const before = useBTStore.getState();
      useBTStore.getState().undo();
      expect(useBTStore.getState().document).toBe(before.document);
    });
  });
});
