import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// The modal's export action goes through useExportImage, which itself needs a
// ReactFlowProvider + html-to-image. Mock the hook so we can drive the
// success/failure paths directly and spy on the call args.
const { exportSpy } = vi.hoisted(() => ({ exportSpy: vi.fn() }));
vi.mock('../../../src/hooks/useExportImage', () => ({
  useExportImage: () => exportSpy,
}));

import { ExportImageModal } from '../../../src/components/export/ExportImageModal';
import { useBTStore, selectActiveTree } from '../../../src/store/bt-store';
import { createEmptyDocument } from '../../../src/core/model/tree';

function reset(): void {
  const document = createEmptyDocument();
  useBTStore.setState({
    document,
    activeTreeId: document.mainTreeId,
    fileName: 'pacman.json',
  });
}

function treeName(): string {
  return selectActiveTree(useBTStore.getState()).name;
}

describe('ExportImageModal', () => {
  beforeEach(() => {
    reset();
    exportSpy.mockReset();
    exportSpy.mockResolvedValue(undefined);
  });

  it('defaults the mode to Themed background (AC1.3)', () => {
    render(<ExportImageModal onClose={vi.fn()} />);
    expect(
      screen.getByRole('radio', { name: /themed background/i }),
    ).toHaveAttribute('aria-checked', 'true');
    expect(
      screen.getByRole('radio', { name: /transparent/i }),
    ).toHaveAttribute('aria-checked', 'false');
  });

  it('prefills the filename with <docStem>-<treeName>.png (AC1.4)', () => {
    render(<ExportImageModal onClose={vi.fn()} />);
    // fileName 'pacman.json' → stem 'pacman'; tree 'Main'.
    expect(screen.getByLabelText('File name')).toHaveValue(
      `pacman-${treeName()}.png`,
    );
  });

  it('disables Export when the filename is empty (AC1.5)', () => {
    render(<ExportImageModal onClose={vi.fn()} />);
    const input = screen.getByLabelText('File name');
    fireEvent.change(input, { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled();
  });

  it('appends .png on export and passes the chosen mode (AC1.4)', async () => {
    const onClose = vi.fn();
    render(<ExportImageModal onClose={onClose} />);
    fireEvent.change(screen.getByLabelText('File name'), {
      target: { value: 'diagram' },
    });
    fireEvent.click(screen.getByRole('radio', { name: /transparent/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    await waitFor(() =>
      expect(exportSpy).toHaveBeenCalledWith({
        mode: 'transparent',
        filename: 'diagram.png',
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('Cancel, Escape, and backdrop click all dismiss (AC1.6)', () => {
    const onClose = vi.fn();
    const { rerender } = render(<ExportImageModal onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(<ExportImageModal onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('shows an inline error and stays open when export fails (AC1.15)', async () => {
    const onClose = vi.fn();
    exportSpy.mockRejectedValue(new Error('canvas exploded'));
    render(<ExportImageModal onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        /Export failed: canvas exploded/i,
      ),
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
