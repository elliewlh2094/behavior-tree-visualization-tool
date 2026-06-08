import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MoveCopyModal } from '../../../src/components/move-copy/MoveCopyModal';
import { EMPTY_SELECTION, type Selection, useBTStore } from '../../../src/store/bt-store';
import type { BTDocument, BTNode, BTTreeDef } from '../../../src/core/model/node';

function node(id: string, kind: BTNode['kind'] = 'Action', treeRef?: string): BTNode {
  return { id, kind, name: id, position: { x: 0, y: 0 }, properties: {}, treeRef };
}

// Tree A (active): Root AR, Action n1, SubTree sub → references "B".
function treeA(): BTTreeDef {
  return {
    id: 'A',
    name: 'A',
    rootId: 'AR',
    nodes: [node('AR', 'Root'), node('n1', 'Action'), node('sub', 'SubTree', 'B')],
    connections: [],
  };
}
const otherTree = (id: string): BTTreeDef => ({
  id,
  name: id,
  rootId: `${id}R`,
  nodes: [node(`${id}R`, 'Root')],
  connections: [],
});

function install(selection: Selection): void {
  const document: BTDocument = {
    version: 2,
    mainTreeId: 'A',
    trees: [treeA(), otherTree('B'), otherTree('C')],
  };
  useBTStore.setState({ document, activeTreeId: 'A', selection });
}

const sel = (...ids: string[]): Selection => ({ nodeIds: new Set(ids), edgeIds: new Set() });

describe('MoveCopyModal', () => {
  beforeEach(() => install(sel('n1')));

  it('lists destination trees (non-active) in document order', () => {
    render(<MoveCopyModal onClose={vi.fn()} />);
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['B', 'C']);
  });

  it('defaults to Move and toggles to Copy, updating the summary verb', () => {
    render(<MoveCopyModal onClose={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Move' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(/^Moving 1 node/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'Copy' }));
    expect(screen.getByText(/^Copying 1 node/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });

  it('V1: disables Confirm with a message when the selection includes Root', () => {
    install(sel('AR', 'n1'));
    render(<MoveCopyModal onClose={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/Root node/i);
    expect(screen.getByRole('button', { name: 'Move' })).toBeDisabled();
  });

  it('V2: disables Confirm when a selected SubTree references the destination', () => {
    install(sel('sub'));
    render(<MoveCopyModal onClose={vi.fn()} />);
    // Default destination is B, which the SubTree references → cycle.
    expect(screen.getByRole('alert')).toHaveTextContent(/cycle/i);
    expect(screen.getByRole('button', { name: 'Move' })).toBeDisabled();

    // Switch destination to C → no cycle, Confirm enabled.
    fireEvent.change(screen.getByLabelText('Destination tree'), { target: { value: 'C' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move' })).toBeEnabled();
  });

  it('Cancel, Escape, and backdrop click all dismiss', () => {
    const onClose = vi.fn();
    const { rerender } = render(<MoveCopyModal onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(<MoveCopyModal onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('Confirm dispatches moveCopyToTree with the chosen destination + mode, then closes', () => {
    const spy = vi.fn();
    useBTStore.setState({ moveCopyToTree: spy });
    const onClose = vi.fn();
    render(<MoveCopyModal onClose={onClose} />);

    fireEvent.change(screen.getByLabelText('Destination tree'), { target: { value: 'C' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Copy' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

    expect(spy).toHaveBeenCalledWith('C', 'copy');
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when the selection is empty', () => {
    install(EMPTY_SELECTION);
    render(<MoveCopyModal onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
