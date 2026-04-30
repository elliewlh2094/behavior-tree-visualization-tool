import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PropertyPanel } from '../../../src/components/property-panel/PropertyPanel';
import {
  type BTStoreState,
  EMPTY_SELECTION,
  selectActiveTree,
  useBTStore,
} from '../../../src/store/bt-store';
import { createEmptyDocument, createEmptyTree } from '../../../src/core/model/tree';
import { addNode, connect } from '../../../src/core/model/operations';
import { shortId, type BehaviorTree } from '../../../src/core/model/node';

function selectNode(id: string): void {
  useBTStore.setState({
    selection: { nodeIds: new Set([id]), edgeIds: new Set() },
  });
}

// Wrap a v1-shaped BehaviorTree as a single-tree BTDocument and install it on
// the store. Tests still build trees via the pure ops over `createEmptyTree()`
// for brevity; the store wraps them at the boundary.
function installTree(tree: BehaviorTree, extra: Partial<BTStoreState> = {}): void {
  const treeId = crypto.randomUUID();
  useBTStore.setState({
    document: {
      version: 2,
      mainTreeId: treeId,
      trees: [
        {
          id: treeId,
          name: 'Main',
          rootId: tree.rootId,
          nodes: tree.nodes,
          connections: tree.connections,
        },
      ],
    },
    activeTreeId: treeId,
    selection: EMPTY_SELECTION,
    ...extra,
  });
}

function resetStore(): void {
  const document = createEmptyDocument();
  useBTStore.setState({
    document,
    activeTreeId: document.mainTreeId,
    selection: EMPTY_SELECTION,
  });
}

describe('PropertyPanel', () => {
  beforeEach(() => {
    resetStore();
  });

  it('renders the empty state when no node is selected', () => {
    render(<PropertyPanel />);
    expect(screen.getByText(/select a node/i)).toBeInTheDocument();
  });

  it('summarizes an edge-only selection', () => {
    useBTStore.setState({
      selection: { nodeIds: new Set(), edgeIds: new Set(['some-edge']) },
    });
    render(<PropertyPanel />);
    expect(screen.getByText(/^1 edge selected$/)).toBeInTheDocument();
  });

  it('summarizes a multi-node selection with plural label', () => {
    const tree = addNode(addNode(createEmptyTree(), 'Sequence', { x: 0, y: 0 }), 'Action', { x: 0, y: 0 });
    const ids = tree.nodes.map((n) => n.id);
    installTree(tree, {
      selection: { nodeIds: new Set([ids[0]!, ids[1]!]), edgeIds: new Set() },
    });
    render(<PropertyPanel />);
    expect(screen.getByText(/^2 nodes selected$/)).toBeInTheDocument();
  });

  it('summarizes mixed node + edge selection with both counts', () => {
    const tree = createEmptyTree();
    installTree(tree, {
      selection: {
        nodeIds: new Set([tree.rootId]),
        edgeIds: new Set(['e1', 'e2']),
      },
    });
    render(<PropertyPanel />);
    expect(screen.getByText(/^1 node, 2 edges selected$/)).toBeInTheDocument();
  });

  it('populates the form when a non-Root node is selected', () => {
    const tree = addNode(createEmptyTree(), 'Sequence', { x: 0, y: 0 });
    const seq = tree.nodes.find((n) => n.kind === 'Sequence')!;
    installTree(tree);
    selectNode(seq.id);

    render(<PropertyPanel />);

    const nameInput = screen.getByLabelText(/name/i) as HTMLInputElement;
    const kindSelect = screen.getByLabelText(/kind/i) as HTMLSelectElement;
    expect(nameInput.value).toBe('');
    expect(kindSelect.value).toBe('Sequence');
    expect(kindSelect.disabled).toBe(false);
  });

  it('disables the kind dropdown when Root is selected', () => {
    const tree = createEmptyTree();
    installTree(tree);
    selectNode(tree.rootId);

    render(<PropertyPanel />);

    const kindSelect = screen.getByLabelText(/kind/i) as HTMLSelectElement;
    expect(kindSelect.disabled).toBe(true);
    expect(kindSelect.value).toBe('Root');
  });

  it('writes name edits to the store on every keystroke', () => {
    const tree = addNode(createEmptyTree(), 'Action', { x: 0, y: 0 });
    const act = tree.nodes.find((n) => n.kind === 'Action')!;
    installTree(tree);
    selectNode(act.id);

    render(<PropertyPanel />);
    const nameInput = screen.getByLabelText(/name/i) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Attack' } });

    const updated = selectActiveTree(useBTStore.getState()).nodes.find(
      (n) => n.id === act.id,
    )!;
    expect(updated.name).toBe('Attack');
  });

  it('writes kind changes to the store for non-Root nodes', () => {
    const tree = addNode(createEmptyTree(), 'Sequence', { x: 0, y: 0 });
    const seq = tree.nodes.find((n) => n.kind === 'Sequence')!;
    installTree(tree);
    selectNode(seq.id);

    render(<PropertyPanel />);
    const kindSelect = screen.getByLabelText(/kind/i) as HTMLSelectElement;
    fireEvent.change(kindSelect, { target: { value: 'Fallback' } });

    const updated = selectActiveTree(useBTStore.getState()).nodes.find(
      (n) => n.id === seq.id,
    )!;
    expect(updated.kind).toBe('Fallback');
  });

  it('shows "Parent: none" when the selected node has no parent (Root)', () => {
    const tree = createEmptyTree();
    installTree(tree);
    selectNode(tree.rootId);

    render(<PropertyPanel />);
    expect(screen.getByText(/^Parent: none$/)).toBeInTheDocument();
  });

  it('shows the parent short ID and label when the selected node has a parent', () => {
    const t1 = addNode(createEmptyTree(), 'Sequence', { x: 0, y: 0 });
    const seq = t1.nodes.find((n) => n.kind === 'Sequence')!;
    const tree = connect(t1, t1.rootId, seq.id);
    installTree(tree);
    selectNode(seq.id);

    render(<PropertyPanel />);
    expect(
      screen.getByText(`Parent: ${shortId(tree.rootId)}… (Root)`),
    ).toBeInTheDocument();
  });

  it('shows children short IDs and labels as a comma-separated list', () => {
    const t1 = addNode(createEmptyTree(), 'Sequence', { x: 0, y: 0 });
    const t2 = addNode(t1, 'Action', { x: 0, y: 0 });
    const seq = t2.nodes.find((n) => n.kind === 'Sequence')!;
    const act = t2.nodes.find((n) => n.kind === 'Action')!;
    const t3 = connect(t2, t2.rootId, seq.id);
    const tree = connect(t3, t2.rootId, act.id);
    installTree(tree);
    selectNode(tree.rootId);

    render(<PropertyPanel />);
    expect(
      screen.getByText(
        `Children: ${shortId(seq.id)}… (Sequence), ${shortId(act.id)}… (Action)`,
      ),
    ).toBeInTheDocument();
  });

  it('shows "Children: none" when the selected node has no outgoing edges', () => {
    const tree = createEmptyTree();
    installTree(tree);
    selectNode(tree.rootId);

    render(<PropertyPanel />);
    expect(screen.getByText(/^Children: none$/)).toBeInTheDocument();
  });

  describe('SubTree treeRef dropdown', () => {
    function installMultiTreeDocument(opts: {
      activeName: string;
      otherNames: string[];
      subtreeRef?: string;
    }): { activeId: string; subtreeId: string } {
      const activeId = crypto.randomUUID();
      const subtreeId = crypto.randomUUID();
      const rootId = crypto.randomUUID();
      const activeTree = {
        id: activeId,
        name: opts.activeName,
        rootId,
        nodes: [
          { id: rootId, kind: 'Root' as const, name: '', position: { x: 0, y: 0 }, properties: {} },
          {
            id: subtreeId,
            kind: 'SubTree' as const,
            name: '',
            position: { x: 0, y: 0 },
            properties: {},
            ...(opts.subtreeRef !== undefined ? { treeRef: opts.subtreeRef } : {}),
          },
        ],
        connections: [],
      };
      const otherTrees = opts.otherNames.map((name) => {
        const id = crypto.randomUUID();
        const r = crypto.randomUUID();
        return {
          id,
          name,
          rootId: r,
          nodes: [{ id: r, kind: 'Root' as const, name: '', position: { x: 0, y: 0 }, properties: {} }],
          connections: [],
        };
      });
      useBTStore.setState({
        document: { version: 2, mainTreeId: activeId, trees: [activeTree, ...otherTrees] },
        activeTreeId: activeId,
        selection: { nodeIds: new Set([subtreeId]), edgeIds: new Set() },
      });
      return { activeId, subtreeId };
    }

    it('renders the dropdown for a SubTree node and lists other trees by name', () => {
      installMultiTreeDocument({ activeName: 'Main', otherNames: ['Patrol', 'Combat'] });
      render(<PropertyPanel />);

      const select = screen.getByLabelText(/tree reference/i) as HTMLSelectElement;
      const optionLabels = Array.from(select.options).map((o) => o.textContent);
      expect(optionLabels).toEqual(['Select a tree…', 'Patrol', 'Combat']);
      expect(select.disabled).toBe(false);
    });

    it('excludes the active tree from the dropdown options', () => {
      installMultiTreeDocument({ activeName: 'Main', otherNames: ['Patrol'] });
      render(<PropertyPanel />);

      const select = screen.getByLabelText(/tree reference/i) as HTMLSelectElement;
      const values = Array.from(select.options).map((o) => o.value);
      expect(values).not.toContain('Main');
    });

    it('does not render the dropdown for non-SubTree nodes', () => {
      const tree = addNode(createEmptyTree(), 'Sequence', { x: 0, y: 0 });
      const seq = tree.nodes.find((n) => n.kind === 'Sequence')!;
      installTree(tree);
      selectNode(seq.id);

      render(<PropertyPanel />);
      expect(screen.queryByLabelText(/tree reference/i)).not.toBeInTheDocument();
    });

    it('disables the dropdown with empty-state placeholder when no other trees exist', () => {
      installMultiTreeDocument({ activeName: 'Main', otherNames: [] });
      render(<PropertyPanel />);

      const select = screen.getByLabelText(/tree reference/i) as HTMLSelectElement;
      expect(select.disabled).toBe(true);
      expect(select.options[0]?.textContent).toBe('Add another tree first');
    });

    it('shows a warning message when treeRef points to a tree that does not exist', () => {
      installMultiTreeDocument({ activeName: 'Main', otherNames: ['Patrol'], subtreeRef: 'Ghost' });
      render(<PropertyPanel />);

      expect(screen.getByText(/tree "Ghost" no longer exists/i)).toBeInTheDocument();
    });

    it('writes treeRef changes to the selected SubTree node and syncs name to the referenced tree', () => {
      const { subtreeId } = installMultiTreeDocument({
        activeName: 'Main',
        otherNames: ['Patrol'],
      });
      render(<PropertyPanel />);

      const select = screen.getByLabelText(/tree reference/i) as HTMLSelectElement;
      fireEvent.change(select, { target: { value: 'Patrol' } });

      const updated = selectActiveTree(useBTStore.getState()).nodes.find(
        (n) => n.id === subtreeId,
      )!;
      expect(updated.treeRef).toBe('Patrol');
      expect(updated.name).toBe('Patrol');
    });

    it('editing the Name of a SubTree with a valid treeRef renames the referenced tree (and propagates)', () => {
      const { subtreeId } = installMultiTreeDocument({
        activeName: 'Main',
        otherNames: ['Patrol'],
        subtreeRef: 'Patrol',
      });
      render(<PropertyPanel />);

      const nameInput = screen.getByLabelText(/^name$/i) as HTMLInputElement;
      fireEvent.change(nameInput, { target: { value: 'Combat' } });

      const state = useBTStore.getState();
      const renamed = state.document.trees.find((t) => t.name === 'Combat');
      expect(renamed).toBeDefined();
      expect(state.document.trees.some((t) => t.name === 'Patrol')).toBe(false);
      const updatedSubtree = selectActiveTree(state).nodes.find((n) => n.id === subtreeId)!;
      expect(updatedSubtree.treeRef).toBe('Combat');
      expect(updatedSubtree.name).toBe('Combat');
    });

    it('editing the Name of a SubTree without a treeRef behaves like a normal node-name edit', () => {
      const { subtreeId } = installMultiTreeDocument({
        activeName: 'Main',
        otherNames: ['Patrol'],
        // no subtreeRef → treeRef is undefined on the SubTree
      });
      render(<PropertyPanel />);

      const nameInput = screen.getByLabelText(/^name$/i) as HTMLInputElement;
      fireEvent.change(nameInput, { target: { value: 'Custom label' } });

      const state = useBTStore.getState();
      // Patrol is not renamed
      expect(state.document.trees.some((t) => t.name === 'Patrol')).toBe(true);
      const updatedSubtree = selectActiveTree(state).nodes.find((n) => n.id === subtreeId)!;
      expect(updatedSubtree.name).toBe('Custom label');
      expect(updatedSubtree.treeRef ?? '').toBe('');
    });
  });

  it('shows edge detail (Edge ID, From, To) when a single edge is selected', () => {
    const t1 = addNode(createEmptyTree(), 'Sequence', { x: 0, y: 0 });
    const seq = t1.nodes.find((n) => n.kind === 'Sequence')!;
    const tree = connect(t1, t1.rootId, seq.id);
    const edge = tree.connections[0]!;
    const root = tree.nodes.find((n) => n.id === tree.rootId)!;
    installTree(tree, {
      selection: { nodeIds: new Set(), edgeIds: new Set([edge.id]) },
    });

    render(<PropertyPanel />);
    expect(screen.getByText(`Edge ID: ${shortId(edge.id)}…`)).toBeInTheDocument();
    expect(
      screen.getByText(`From: ${shortId(root.id)}… (${root.kind})`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`To: ${shortId(seq.id)}… (${seq.kind})`),
    ).toBeInTheDocument();
  });
});
