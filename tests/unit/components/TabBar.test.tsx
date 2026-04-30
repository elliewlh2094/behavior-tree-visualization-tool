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

  it('renders the "+" button as disabled (T11 wires it)', () => {
    installMultiTreeDocument({ names: ['Main'], mainName: 'Main' });
    render(<TabBar />);

    const addButton = screen.getByRole('button', { name: /create new tree/i });
    expect(addButton).toBeDisabled();
  });

  it('renders a single tab when the document has only one tree', () => {
    render(<TabBar />); // resetStore() leaves a one-tree document

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(1);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  });
});
