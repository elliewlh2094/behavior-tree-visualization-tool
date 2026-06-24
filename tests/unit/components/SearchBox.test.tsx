import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { BTDocument, BTNode } from '../../../src/core/model/node';
import { useBTStore } from '../../../src/store/bt-store';

// SearchBox centers matches via useReactFlow().setCenter, preserving the
// current zoom from getZoom(). Both need a ReactFlowProvider at runtime; we
// mock them so we can spy on setCenter and pin the zoom (memory: setCenter
// snaps zoom to 1.0 when zoom is omitted — the component must pass getZoom()).
const { mock } = vi.hoisted(() => ({
  mock: { setCenter: vi.fn(), zoom: 2 },
}));

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({ setCenter: mock.setCenter, getZoom: () => mock.zoom }),
}));

import { SearchBox } from '../../../src/components/canvas/SearchBox';

function node(id: string, name: string, x: number, y: number): BTNode {
  return { id, kind: 'Action', name, position: { x, y }, properties: {} };
}

// Doc whose main tree holds Root + three named leaves. 'patrol' matches two.
function seedDoc(): BTDocument {
  const root: BTNode = {
    id: 'root',
    kind: 'Root',
    name: 'Root',
    position: { x: 0, y: 0 },
    properties: {},
  };
  return {
    version: 2,
    mainTreeId: 't1',
    trees: [
      {
        id: 't1',
        name: 'Main',
        rootId: 'root',
        nodes: [
          root,
          node('a', 'Patrol', 100, 200),
          node('b', 'Patrol Area', 300, 400),
          node('c', 'Chase', 500, 600),
        ],
        connections: [],
      },
    ],
  };
}

function open(): void {
  useBTStore.getState().setDocument(seedDoc());
  useBTStore.getState().setSearchOpen(true);
}

describe('SearchBox (FR6)', () => {
  beforeEach(() => {
    mock.setCenter = vi.fn();
    mock.zoom = 2;
    open();
  });

  it('renders nothing when search is closed', () => {
    useBTStore.getState().setSearchOpen(false);
    const { container } = render(<SearchBox />);
    expect(container).toBeEmptyDOMElement();
  });

  it('case-insensitive substring filter counts matches in the active tree', () => {
    render(<SearchBox />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'patrol' } });
    // Patrol + Patrol Area match; Root and Chase do not.
    expect(screen.getByTitle('Matches in current tree')).toHaveTextContent('1/2');
    expect(useBTStore.getState().searchMatchIds).toEqual(new Set(['a', 'b']));
    expect(useBTStore.getState().searchCurrentId).toBe('a');
  });

  it('centers the first match preserving the current zoom', () => {
    render(<SearchBox />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'patrol' } });
    // First match 'Patrol' at (100,200): center on (100+75, 200+37.5).
    expect(mock.setCenter).toHaveBeenLastCalledWith(175, 237.5, {
      zoom: 2,
      duration: 200,
    });
  });

  it('Next advances the current match and recenters', () => {
    render(<SearchBox />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'patrol' } });
    fireEvent.click(screen.getByRole('button', { name: /next match/i }));
    expect(screen.getByTitle('Matches in current tree')).toHaveTextContent('2/2');
    expect(useBTStore.getState().searchCurrentId).toBe('b');
    // Second match 'Patrol Area' at (300,400): center on (375, 437.5).
    expect(mock.setCenter).toHaveBeenLastCalledWith(375, 437.5, {
      zoom: 2,
      duration: 200,
    });
  });

  it('Previous wraps from the first match to the last', () => {
    render(<SearchBox />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'patrol' } });
    fireEvent.click(screen.getByRole('button', { name: /previous match/i }));
    expect(screen.getByTitle('Matches in current tree')).toHaveTextContent('2/2');
    expect(useBTStore.getState().searchCurrentId).toBe('b');
  });

  it('Enter steps to the next match; Shift+Enter to the previous', () => {
    render(<SearchBox />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'patrol' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByTitle('Matches in current tree')).toHaveTextContent('2/2');
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(screen.getByTitle('Matches in current tree')).toHaveTextContent('1/2');
  });

  it('Escape closes search and clears store highlights', () => {
    render(<SearchBox />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'patrol' } });
    expect(useBTStore.getState().searchMatchIds.size).toBe(2);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(useBTStore.getState().searchOpen).toBe(false);
    expect(useBTStore.getState().searchMatchIds.size).toBe(0);
    expect(useBTStore.getState().searchCurrentId).toBeNull();
  });

  it('no query yields a 0/0 counter and no matches', () => {
    render(<SearchBox />);
    expect(screen.getByTitle('Matches in current tree')).toHaveTextContent('0/0');
    expect(useBTStore.getState().searchMatchIds.size).toBe(0);
  });
});
