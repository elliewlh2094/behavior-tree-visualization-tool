import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TabBar } from '../../../src/components/tab-bar/TabBar';
import { EMPTY_SELECTION, useBTStore } from '../../../src/store/bt-store';
import { createEmptyDocument } from '../../../src/core/model/tree';

function resetStore(): void {
  const document = createEmptyDocument();
  useBTStore.setState({
    document,
    activeTreeId: document.mainTreeId,
    selection: EMPTY_SELECTION,
  });
}

function installMultiTreeDocument(opts: {
  names: readonly string[];
  mainName: string;
  activeName?: string;
}): { idsByName: Record<string, string> } {
  const idsByName: Record<string, string> = {};
  const trees = opts.names.map((name) => {
    const id = crypto.randomUUID();
    idsByName[name] = id;
    const rootId = crypto.randomUUID();
    return {
      id,
      name,
      rootId,
      nodes: [
        { id: rootId, kind: 'Root' as const, name: '', position: { x: 0, y: 0 }, properties: {} },
      ],
      connections: [],
    };
  });
  const mainId = idsByName[opts.mainName]!;
  const activeId = idsByName[opts.activeName ?? opts.mainName]!;
  useBTStore.setState({
    document: { version: 2, mainTreeId: mainId, trees },
    activeTreeId: activeId,
    selection: EMPTY_SELECTION,
  });
  return { idsByName };
}

describe('TabBar', () => {
  beforeEach(resetStore);

  it('renders one tab per tree in the document', () => {
    installMultiTreeDocument({
      names: ['Main', 'Patrol', 'Combat'],
      mainName: 'Main',
    });
    render(<TabBar />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Main', 'Patrol', 'Combat']);
  });

  it('marks the active tree tab with aria-selected="true" and others false', () => {
    installMultiTreeDocument({
      names: ['Main', 'Patrol'],
      mainName: 'Main',
      activeName: 'Patrol',
    });
    render(<TabBar />);

    expect(screen.getByRole('tab', { name: /Main/ })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: /Patrol/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('clicking an inactive tab updates activeTreeId in the store', () => {
    const { idsByName } = installMultiTreeDocument({
      names: ['Main', 'Patrol'],
      mainName: 'Main',
    });
    render(<TabBar />);

    fireEvent.click(screen.getByRole('tab', { name: /Patrol/ }));
    expect(useBTStore.getState().activeTreeId).toBe(idsByName.Patrol);
  });

  it('renders the home indicator only on the main tree tab', () => {
    installMultiTreeDocument({
      names: ['Main', 'Patrol'],
      mainName: 'Main',
    });
    render(<TabBar />);

    const mainTab = screen.getByRole('tab', { name: /Main/ });
    const patrolTab = screen.getByRole('tab', { name: /Patrol/ });
    expect(mainTab.querySelector('svg')).not.toBeNull();
    expect(patrolTab.querySelector('svg')).toBeNull();
  });

  it('clicking "+" creates a new tree with an auto-generated name and makes it active', () => {
    installMultiTreeDocument({ names: ['Main'], mainName: 'Main' });
    render(<TabBar />);

    fireEvent.click(screen.getByRole('button', { name: /create new tree/i }));

    const state = useBTStore.getState();
    expect(state.document.trees.map((t) => t.name)).toEqual(['Main', 'Tree 2']);
    const created = state.document.trees.find((t) => t.name === 'Tree 2')!;
    expect(state.activeTreeId).toBe(created.id);
    // New tree starts with a single Root node, no connections.
    expect(created.nodes).toHaveLength(1);
    expect(created.nodes[0]!.kind).toBe('Root');
    expect(created.connections).toEqual([]);
  });

  it('renders a single tab when the document has only one tree', () => {
    render(<TabBar />); // resetStore() leaves a one-tree document

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(1);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('double-clicking a tab opens an inline rename input; Enter commits via renameTree', () => {
    const { idsByName } = installMultiTreeDocument({
      names: ['Main', 'Patrol'],
      mainName: 'Main',
      activeName: 'Patrol',
    });
    render(<TabBar />);

    fireEvent.doubleClick(screen.getByRole('tab', { name: /Patrol/ }));
    const input = screen.getByLabelText('Tree name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Recon' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const renamed = useBTStore
      .getState()
      .document.trees.find((t) => t.id === idsByName.Patrol)!;
    expect(renamed.name).toBe('Recon');
  });

  it('Escape during rename cancels without calling renameTree', () => {
    const { idsByName } = installMultiTreeDocument({
      names: ['Main', 'Patrol'],
      mainName: 'Main',
    });
    render(<TabBar />);

    fireEvent.doubleClick(screen.getByRole('tab', { name: /Patrol/ }));
    const input = screen.getByLabelText('Tree name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Discarded' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    const tree = useBTStore.getState().document.trees.find((t) => t.id === idsByName.Patrol)!;
    expect(tree.name).toBe('Patrol');
  });

  it('main tab does not show a delete button', () => {
    installMultiTreeDocument({ names: ['Main', 'Patrol'], mainName: 'Main' });
    render(<TabBar />);

    expect(screen.queryByRole('button', { name: /delete main/i })).toBeNull();
    expect(screen.getByRole('button', { name: /delete patrol/i })).toBeInTheDocument();
  });

  it('clicking a tab\'s × opens a confirm dialog; Delete deletes the tree and switches active to main', () => {
    const { idsByName } = installMultiTreeDocument({
      names: ['Main', 'Patrol'],
      mainName: 'Main',
      activeName: 'Patrol',
    });
    render(<TabBar />);

    fireEvent.click(screen.getByRole('button', { name: /delete patrol/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    const state = useBTStore.getState();
    expect(state.document.trees.map((t) => t.id)).toEqual([idsByName.Main]);
    expect(state.activeTreeId).toBe(idsByName.Main);
    // Dialog dismissed.
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Cancel on the delete dialog closes it without deleting', () => {
    const { idsByName } = installMultiTreeDocument({
      names: ['Main', 'Patrol'],
      mainName: 'Main',
    });
    render(<TabBar />);

    fireEvent.click(screen.getByRole('button', { name: /delete patrol/i }));
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(useBTStore.getState().document.trees.map((t) => t.id)).toEqual([
      idsByName.Main,
      idsByName.Patrol,
    ]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Escape closes the delete dialog without deleting', () => {
    const { idsByName } = installMultiTreeDocument({
      names: ['Main', 'Patrol'],
      mainName: 'Main',
    });
    render(<TabBar />);

    fireEvent.click(screen.getByRole('button', { name: /delete patrol/i }));
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(useBTStore.getState().document.trees.map((t) => t.id)).toEqual([
      idsByName.Main,
      idsByName.Patrol,
    ]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
