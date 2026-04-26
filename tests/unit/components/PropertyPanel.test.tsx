import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PropertyPanel } from '../../../src/components/property-panel/PropertyPanel';
import { EMPTY_SELECTION, useBTStore } from '../../../src/store/bt-store';
import { createEmptyTree } from '../../../src/core/model/tree';
import { addNode, connect } from '../../../src/core/model/operations';
import { shortId } from '../../../src/core/model/node';

function selectNode(id: string): void {
  useBTStore.setState({
    selection: { nodeIds: new Set([id]), edgeIds: new Set() },
  });
}

function resetStore(): void {
  useBTStore.setState({ tree: createEmptyTree(), selection: EMPTY_SELECTION });
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
    useBTStore.setState({
      tree,
      selection: { nodeIds: new Set([ids[0]!, ids[1]!]), edgeIds: new Set() },
    });
    render(<PropertyPanel />);
    expect(screen.getByText(/^2 nodes selected$/)).toBeInTheDocument();
  });

  it('summarizes mixed node + edge selection with both counts', () => {
    const tree = createEmptyTree();
    useBTStore.setState({
      tree,
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
    useBTStore.setState({ tree });
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
    useBTStore.setState({ tree });
    selectNode(tree.rootId);

    render(<PropertyPanel />);

    const kindSelect = screen.getByLabelText(/kind/i) as HTMLSelectElement;
    expect(kindSelect.disabled).toBe(true);
    expect(kindSelect.value).toBe('Root');
  });

  it('writes name edits to the store on every keystroke', () => {
    const tree = addNode(createEmptyTree(), 'Action', { x: 0, y: 0 });
    const act = tree.nodes.find((n) => n.kind === 'Action')!;
    useBTStore.setState({ tree });
    selectNode(act.id);

    render(<PropertyPanel />);
    const nameInput = screen.getByLabelText(/name/i) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Attack' } });

    const updated = useBTStore.getState().tree.nodes.find((n) => n.id === act.id)!;
    expect(updated.name).toBe('Attack');
  });

  it('writes kind changes to the store for non-Root nodes', () => {
    const tree = addNode(createEmptyTree(), 'Sequence', { x: 0, y: 0 });
    const seq = tree.nodes.find((n) => n.kind === 'Sequence')!;
    useBTStore.setState({ tree });
    selectNode(seq.id);

    render(<PropertyPanel />);
    const kindSelect = screen.getByLabelText(/kind/i) as HTMLSelectElement;
    fireEvent.change(kindSelect, { target: { value: 'Fallback' } });

    const updated = useBTStore.getState().tree.nodes.find((n) => n.id === seq.id)!;
    expect(updated.kind).toBe('Fallback');
  });

  it('shows "Parent: none" when the selected node has no parent (Root)', () => {
    const tree = createEmptyTree();
    useBTStore.setState({ tree });
    selectNode(tree.rootId);

    render(<PropertyPanel />);
    expect(screen.getByText(/^Parent: none$/)).toBeInTheDocument();
  });

  it('shows the parent short ID when the selected node has a parent', () => {
    const t1 = addNode(createEmptyTree(), 'Sequence', { x: 0, y: 0 });
    const seq = t1.nodes.find((n) => n.kind === 'Sequence')!;
    const tree = connect(t1, t1.rootId, seq.id);
    useBTStore.setState({ tree });
    selectNode(seq.id);

    render(<PropertyPanel />);
    expect(screen.getByText(`Parent: ${shortId(tree.rootId)}…`)).toBeInTheDocument();
  });

  it('shows children short IDs as comma-separated list', () => {
    const t1 = addNode(createEmptyTree(), 'Sequence', { x: 0, y: 0 });
    const t2 = addNode(t1, 'Action', { x: 0, y: 0 });
    const seq = t2.nodes.find((n) => n.kind === 'Sequence')!;
    const act = t2.nodes.find((n) => n.kind === 'Action')!;
    const t3 = connect(t2, t2.rootId, seq.id);
    const tree = connect(t3, t2.rootId, act.id);
    useBTStore.setState({ tree });
    selectNode(tree.rootId);

    render(<PropertyPanel />);
    expect(
      screen.getByText(`Children: ${shortId(seq.id)}, ${shortId(act.id)}`),
    ).toBeInTheDocument();
  });

  it('shows "Children: none" when the selected node has no outgoing edges', () => {
    const tree = createEmptyTree();
    useBTStore.setState({ tree });
    selectNode(tree.rootId);

    render(<PropertyPanel />);
    expect(screen.getByText(/^Children: none$/)).toBeInTheDocument();
  });

  it('shows edge detail (Edge ID, From, To) when a single edge is selected', () => {
    const t1 = addNode(createEmptyTree(), 'Sequence', { x: 0, y: 0 });
    const seq = t1.nodes.find((n) => n.kind === 'Sequence')!;
    const tree = connect(t1, t1.rootId, seq.id);
    const edge = tree.connections[0]!;
    const root = tree.nodes.find((n) => n.id === tree.rootId)!;
    useBTStore.setState({
      tree,
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
