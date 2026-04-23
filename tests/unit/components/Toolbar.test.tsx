import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Toolbar } from '../../../src/components/toolbar/Toolbar';
import { useBTStore } from '../../../src/store/bt-store';
import { createEmptyTree } from '../../../src/core/model/tree';
import { addNode } from '../../../src/core/model/operations';
import { serialize } from '../../../src/core/serialization/serialize';

function resetStore(): void {
  useBTStore.setState({ tree: createEmptyTree(), selection: null });
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
    expect(screen.getByRole('button', { name: /open/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('Save downloads a Blob whose contents equal serialize(currentTree)', async () => {
    const tree = addNode(createEmptyTree(), 'Sequence', { x: 40, y: 40 });
    useBTStore.setState({ tree, selection: null });

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
    expect(text).toBe(serialize(tree));
  });

  it('Open replaces the tree in the store with a valid uploaded file', async () => {
    const uploadedTree = addNode(createEmptyTree(), 'Action', { x: 0, y: 0 });
    const file = new File([serialize(uploadedTree)], 'tree.json', { type: 'application/json' });

    render(<Toolbar />);
    const input = screen.getByTestId('toolbar-open-input') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(useBTStore.getState().tree.nodes).toHaveLength(2);
    });
    expect(useBTStore.getState().tree.nodes.some((n) => n.kind === 'Action')).toBe(true);
  });

  it('Open shows a user-visible error and leaves the tree unchanged on malformed JSON', async () => {
    const originalTree = useBTStore.getState().tree;
    const file = new File(['{not json'], 'broken.json', { type: 'application/json' });

    render(<Toolbar />);
    const input = screen.getByTestId('toolbar-open-input') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/json/i);
    });
    expect(useBTStore.getState().tree).toBe(originalTree);
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
