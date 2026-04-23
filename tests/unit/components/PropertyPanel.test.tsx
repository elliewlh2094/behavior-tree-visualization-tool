import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PropertyPanel } from '../../../src/components/property-panel/PropertyPanel';
import { useBTStore } from '../../../src/store/bt-store';
import { createEmptyTree } from '../../../src/core/model/tree';
import { addNode } from '../../../src/core/model/operations';

function resetStore(): void {
  useBTStore.setState({ tree: createEmptyTree(), selection: null });
}

describe('PropertyPanel', () => {
  beforeEach(() => {
    resetStore();
  });

  it('renders the empty state when no node is selected', () => {
    render(<PropertyPanel />);
    expect(screen.getByText(/select a node/i)).toBeInTheDocument();
  });

  it('renders the empty state when an edge is selected', () => {
    useBTStore.setState({ selection: { type: 'edge', id: 'some-edge' } });
    render(<PropertyPanel />);
    expect(screen.getByText(/select a node/i)).toBeInTheDocument();
  });

  it('populates the form when a non-Root node is selected', () => {
    const tree = addNode(createEmptyTree(), 'Sequence', { x: 0, y: 0 });
    const seq = tree.nodes.find((n) => n.kind === 'Sequence')!;
    useBTStore.setState({ tree, selection: { type: 'node', id: seq.id } });

    render(<PropertyPanel />);

    const nameInput = screen.getByLabelText(/name/i) as HTMLInputElement;
    const kindSelect = screen.getByLabelText(/kind/i) as HTMLSelectElement;
    expect(nameInput.value).toBe('');
    expect(kindSelect.value).toBe('Sequence');
    expect(kindSelect.disabled).toBe(false);
  });

  it('disables the kind dropdown when Root is selected', () => {
    const tree = createEmptyTree();
    useBTStore.setState({ tree, selection: { type: 'node', id: tree.rootId } });

    render(<PropertyPanel />);

    const kindSelect = screen.getByLabelText(/kind/i) as HTMLSelectElement;
    expect(kindSelect.disabled).toBe(true);
    expect(kindSelect.value).toBe('Root');
  });

  it('writes name edits to the store on every keystroke', () => {
    const tree = addNode(createEmptyTree(), 'Action', { x: 0, y: 0 });
    const act = tree.nodes.find((n) => n.kind === 'Action')!;
    useBTStore.setState({ tree, selection: { type: 'node', id: act.id } });

    render(<PropertyPanel />);
    const nameInput = screen.getByLabelText(/name/i) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Attack' } });

    const updated = useBTStore.getState().tree.nodes.find((n) => n.id === act.id)!;
    expect(updated.name).toBe('Attack');
  });

  it('writes kind changes to the store for non-Root nodes', () => {
    const tree = addNode(createEmptyTree(), 'Sequence', { x: 0, y: 0 });
    const seq = tree.nodes.find((n) => n.kind === 'Sequence')!;
    useBTStore.setState({ tree, selection: { type: 'node', id: seq.id } });

    render(<PropertyPanel />);
    const kindSelect = screen.getByLabelText(/kind/i) as HTMLSelectElement;
    fireEvent.change(kindSelect, { target: { value: 'Fallback' } });

    const updated = useBTStore.getState().tree.nodes.find((n) => n.id === seq.id)!;
    expect(updated.kind).toBe('Fallback');
  });
});
