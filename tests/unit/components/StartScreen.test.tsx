import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StartScreen } from '../../../src/components/start-screen/StartScreen';
import { EMPTY_SELECTION, useBTStore } from '../../../src/store/bt-store';
import { createEmptyTree } from '../../../src/core/model/tree';
import { addNode } from '../../../src/core/model/operations';
import { serialize } from '../../../src/core/serialization/serialize';

function resetStore(): void {
  useBTStore.setState({
    tree: createEmptyTree(),
    selection: EMPTY_SELECTION,
    fileName: 'Untitled.json',
  });
}

describe('StartScreen', () => {
  beforeEach(() => {
    resetStore();
  });

  it('renders brand, tagline, and the two CTA buttons', () => {
    render(<StartScreen onNewTree={() => {}} onFileOpened={() => {}} />);
    expect(screen.getByRole('heading', { name: 'BT Visualizer' })).toBeInTheDocument();
    expect(screen.getByText(/author, visualize, and validate/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new tree/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open file/i })).toBeInTheDocument();
  });

  it('clicking "New Tree" calls onNewTree', () => {
    const onNewTree = vi.fn();
    render(<StartScreen onNewTree={onNewTree} onFileOpened={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /new tree/i }));

    expect(onNewTree).toHaveBeenCalledOnce();
  });

  it('clicking "Open File" triggers the hidden file input click', () => {
    render(<StartScreen onNewTree={() => {}} onFileOpened={() => {}} />);
    const input = screen.getByTestId('start-screen-open-input') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');

    fireEvent.click(screen.getByRole('button', { name: /open file/i }));

    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it('uploading a valid file loads the tree, sets the file name, and calls onFileOpened', async () => {
    const onFileOpened = vi.fn();
    const uploadedTree = addNode(createEmptyTree(), 'Action', { x: 0, y: 0 });
    const file = new File([serialize(uploadedTree)], 'loaded.json', {
      type: 'application/json',
    });

    render(<StartScreen onNewTree={() => {}} onFileOpened={onFileOpened} />);
    const input = screen.getByTestId('start-screen-open-input') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(useBTStore.getState().tree.nodes).toHaveLength(2);
    });
    expect(useBTStore.getState().fileName).toBe('loaded.json');
    expect(onFileOpened).toHaveBeenCalledOnce();
  });

  it('uploading malformed JSON shows an error and does NOT call onFileOpened', async () => {
    const onFileOpened = vi.fn();
    const file = new File(['{not json'], 'broken.json', {
      type: 'application/json',
    });
    const originalTree = useBTStore.getState().tree;

    render(<StartScreen onNewTree={() => {}} onFileOpened={onFileOpened} />);
    const input = screen.getByTestId('start-screen-open-input') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(onFileOpened).not.toHaveBeenCalled();
    expect(useBTStore.getState().tree).toBe(originalTree);
  });
});
