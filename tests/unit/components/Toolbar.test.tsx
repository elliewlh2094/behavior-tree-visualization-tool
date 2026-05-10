import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import {
  render as rtlRender,
  screen,
  fireEvent,
  waitFor,
  type RenderOptions,
} from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import type { ReactElement } from 'react';
import { Toolbar } from '../../../src/components/toolbar/Toolbar';
import {
  EMPTY_SELECTION,
  selectActiveTree,
  useBTStore,
} from '../../../src/store/bt-store';
import { createEmptyDocument } from '../../../src/core/model/tree';
import { addNode } from '../../../src/core/model/operations';
import { serialize } from '../../../src/core/serialization/serialize';
import { migrateV1toV2 } from '../../../src/core/serialization/migrate';
import { createEmptyTree } from '../../../src/core/model/tree';

// Toolbar uses useApplyLayout(), which calls useReactFlow() and so requires
// a ReactFlowProvider ancestor. App.tsx provides this in production; tests
// must do the same.
function render(ui: ReactElement, options?: RenderOptions) {
  return rtlRender(<ReactFlowProvider>{ui}</ReactFlowProvider>, options);
}

function resetStore(): void {
  const document = createEmptyDocument();
  useBTStore.setState({
    document,
    activeTreeId: document.mainTreeId,
    selection: EMPTY_SELECTION,
    fileName: 'Untitled.json',
  });
}

describe('Toolbar', () => {
  beforeEach(() => {
    resetStore();
    // jsdom does not implement URL.createObjectURL / revokeObjectURL.
    (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = () =>
      'blob:mock';
    (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => {};
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders Open and Save buttons', () => {
    render(<Toolbar />);
    expect(screen.getByRole('button', { name: /^open$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
  });

  it('renders the BT Visualizer branding cluster', () => {
    render(<Toolbar />);
    expect(screen.getByText('BT Visualizer')).toBeInTheDocument();
  });

  it('shows the initial file name "Untitled.json"', () => {
    render(<Toolbar />);
    expect(screen.getByTestId('toolbar-filename')).toHaveTextContent('Untitled.json');
  });

  it('updates the file name display after opening a file', async () => {
    const uploadedTree = addNode(createEmptyTree(), 'Action', { x: 0, y: 0 });
    const file = new File([serialize(migrateV1toV2(uploadedTree))], 'my-bot.json', {
      type: 'application/json',
    });

    render(<Toolbar />);
    const input = screen.getByTestId('toolbar-open-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByTestId('toolbar-filename')).toHaveTextContent('my-bot.json');
    });
  });

  it('clicking the file name swaps in an input pre-filled with the current name', () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByTestId('toolbar-filename'));

    const input = screen.getByTestId('toolbar-filename-input') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('Untitled.json');
  });

  it('typing a new name and pressing Enter updates the store and exits edit mode', () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByTestId('toolbar-filename'));
    const input = screen.getByTestId('toolbar-filename-input') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'attack-bot.json' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(useBTStore.getState().fileName).toBe('attack-bot.json');
    expect(screen.queryByTestId('toolbar-filename-input')).toBeNull();
    expect(screen.getByTestId('toolbar-filename')).toHaveTextContent('attack-bot.json');
  });

  it('blur on the rename input commits the change (same as Enter)', () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByTestId('toolbar-filename'));
    const input = screen.getByTestId('toolbar-filename-input') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'patrol.json' } });
    fireEvent.blur(input);

    expect(useBTStore.getState().fileName).toBe('patrol.json');
  });

  it('Escape cancels the rename and reverts to the original name', () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByTestId('toolbar-filename'));
    const input = screen.getByTestId('toolbar-filename-input') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'discarded.json' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(useBTStore.getState().fileName).toBe('Untitled.json');
    expect(screen.queryByTestId('toolbar-filename-input')).toBeNull();
  });

  it('empty name on confirm reverts to the previous value', () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByTestId('toolbar-filename'));
    const input = screen.getByTestId('toolbar-filename-input') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(useBTStore.getState().fileName).toBe('Untitled.json');
  });

  it('appends .json when the user removes or omits the extension', () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByTestId('toolbar-filename'));
    const input = screen.getByTestId('toolbar-filename-input') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'no-extension' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(useBTStore.getState().fileName).toBe('no-extension.json');
  });

  it('rename does not push to undo history', () => {
    const undoStackBefore = useBTStore.getState().undoStack;
    render(<Toolbar />);
    fireEvent.click(screen.getByTestId('toolbar-filename'));
    const input = screen.getByTestId('toolbar-filename-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'no-history.json' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(useBTStore.getState().undoStack).toBe(undoStackBefore);
  });

  it('Save uses the current fileName from the store as the download name', () => {
    useBTStore.setState({ fileName: 'my-tree.json' });
    const downloadNames: string[] = [];
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreate(tag) as HTMLElement;
      if (tag.toLowerCase() === 'a') {
        const anchor = el as HTMLAnchorElement;
        const orig = Object.getOwnPropertyDescriptor(
          HTMLAnchorElement.prototype,
          'download',
        );
        Object.defineProperty(anchor, 'download', {
          configurable: true,
          set(v: string) {
            downloadNames.push(v);
            orig?.set?.call(this, v);
          },
          get() {
            return orig?.get?.call(this) ?? '';
          },
        });
      }
      return el;
    });

    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(downloadNames).toContain('my-tree.json');
  });

  it('Save downloads a Blob whose contents equal serialize(currentDocument)', async () => {
    const baseDoc = createEmptyDocument();
    const treeId = baseDoc.mainTreeId;
    const seedTree = baseDoc.trees.find((t) => t.id === treeId)!;
    const nextTree = addNode(seedTree, 'Sequence', { x: 40, y: 40 });
    const document = {
      ...baseDoc,
      trees: baseDoc.trees.map((t) => (t.id === treeId ? nextTree : t)),
    };
    useBTStore.setState({
      document,
      activeTreeId: treeId,
      selection: EMPTY_SELECTION,
    });

    const blobs: Blob[] = [];
    const createSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockImplementation((obj: Blob | MediaSource) => {
        blobs.push(obj as Blob);
        return 'blob:mock';
      });
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(createSpy).toHaveBeenCalledOnce();
    expect(revokeSpy).toHaveBeenCalledOnce();
    expect(blobs.length).toBe(1);
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.readAsText(blobs[0]!);
    });
    // Save now serializes the BTDocument directly — byte-equal to
    // serialize(state.document).
    expect(text).toBe(serialize(document));
  });

  it('Open replaces the tree in the store with a valid uploaded file', async () => {
    const uploadedTree = addNode(createEmptyTree(), 'Action', { x: 0, y: 0 });
    const file = new File([serialize(migrateV1toV2(uploadedTree))], 'tree.json', { type: 'application/json' });

    render(<Toolbar />);
    const input = screen.getByTestId('toolbar-open-input') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(selectActiveTree(useBTStore.getState()).nodes).toHaveLength(2);
    });
    expect(
      selectActiveTree(useBTStore.getState()).nodes.some((n) => n.kind === 'Action'),
    ).toBe(true);
  });

  it('Open shows a user-visible error and leaves the tree unchanged on malformed JSON', async () => {
    const originalDocument = useBTStore.getState().document;
    const file = new File(['{not json'], 'broken.json', { type: 'application/json' });

    render(<Toolbar />);
    const input = screen.getByTestId('toolbar-open-input') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/json/i);
    });
    expect(useBTStore.getState().document).toBe(originalDocument);
  });

  it('Ctrl+S triggers Save (creates a download) and preventDefaults', () => {
    let created = 0;
    (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = () => {
      created++;
      return 'blob:mock';
    };

    render(<Toolbar />);
    const event = new KeyboardEvent('keydown', {
      key: 's',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    const dispatched = window.dispatchEvent(event);

    expect(created).toBe(1);
    expect(dispatched).toBe(false); // preventDefault was called
  });

  it('Cmd+S (metaKey) also triggers Save', () => {
    let created = 0;
    (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = () => {
      created++;
      return 'blob:mock';
    };

    render(<Toolbar />);
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true, cancelable: true }),
    );

    expect(created).toBe(1);
  });

  it('Ctrl+O clicks the hidden file input and preventDefaults', () => {
    render(<Toolbar />);
    const input = screen.getByTestId('toolbar-open-input') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');

    const event = new KeyboardEvent('keydown', {
      key: 'o',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    const dispatched = window.dispatchEvent(event);

    expect(clickSpy).toHaveBeenCalledOnce();
    expect(dispatched).toBe(false);
  });

  it('Ctrl+D triggers duplicateSelection and preventDefaults', () => {
    // Seed: Root + one Action selected. Ctrl+D should add a second Action
    // (the duplicate) and swap selection to it.
    useBTStore.getState().addNode('Action', { x: 100, y: 100 });
    const actionId = selectActiveTree(useBTStore.getState()).nodes.find(
      (n) => n.kind === 'Action',
    )!.id;
    useBTStore.setState({
      selection: { nodeIds: new Set([actionId]), edgeIds: new Set() },
    });
    const beforeCount = selectActiveTree(useBTStore.getState()).nodes.length;

    render(<Toolbar />);
    const event = new KeyboardEvent('keydown', {
      key: 'd',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    const dispatched = window.dispatchEvent(event);

    expect(selectActiveTree(useBTStore.getState()).nodes.length).toBe(beforeCount + 1);
    expect(dispatched).toBe(false); // preventDefault called (browser bookmark default swallowed)
    // Selection swapped to the duplicate.
    const sel = useBTStore.getState().selection;
    expect(sel.nodeIds.size).toBe(1);
    expect(sel.nodeIds.has(actionId)).toBe(false);
  });

  it('Cmd+D (metaKey) also triggers duplicateSelection', () => {
    useBTStore.getState().addNode('Action', { x: 100, y: 100 });
    const actionId = selectActiveTree(useBTStore.getState()).nodes.find(
      (n) => n.kind === 'Action',
    )!.id;
    useBTStore.setState({
      selection: { nodeIds: new Set([actionId]), edgeIds: new Set() },
    });
    const beforeCount = selectActiveTree(useBTStore.getState()).nodes.length;

    render(<Toolbar />);
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'd', metaKey: true, bubbles: true, cancelable: true }),
    );

    expect(selectActiveTree(useBTStore.getState()).nodes.length).toBe(beforeCount + 1);
  });

  it('Ctrl+D inside an editable target does NOT duplicate', () => {
    useBTStore.getState().addNode('Action', { x: 100, y: 100 });
    const actionId = selectActiveTree(useBTStore.getState()).nodes.find(
      (n) => n.kind === 'Action',
    )!.id;
    useBTStore.setState({
      selection: { nodeIds: new Set([actionId]), edgeIds: new Set() },
    });
    const beforeCount = selectActiveTree(useBTStore.getState()).nodes.length;

    render(<Toolbar />);
    // Mount an input, focus it, dispatch the event from there. The handler
    // is registered on `window`, so the event still reaches it; the
    // editable-target guard checks `e.target` and bails.
    const input = window.document.createElement('input');
    window.document.body.appendChild(input);
    input.focus();
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, bubbles: true, cancelable: true }),
    );

    expect(selectActiveTree(useBTStore.getState()).nodes.length).toBe(beforeCount);
    window.document.body.removeChild(input);
  });

  it('plain S keypress does nothing', () => {
    let created = 0;
    (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = () => {
      created++;
      return 'blob:mock';
    };

    render(<Toolbar />);
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 's', bubbles: true, cancelable: true }),
    );

    expect(created).toBe(0);
  });

  it('Open shows a schema error with field path when the content is structurally wrong', async () => {
    const badTree = {
      version: 1,
      rootId: 'ghost',
      nodes: [{ id: 'n1', kind: 'Root', name: '', position: { x: 0, y: 0 }, properties: {} }],
      connections: [],
    };
    const file = new File([JSON.stringify(badTree)], 'bad.json', { type: 'application/json' });

    render(<Toolbar />);
    const input = screen.getByTestId('toolbar-open-input') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/rootId/i);
    });
  });
});
