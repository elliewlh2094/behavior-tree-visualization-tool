import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UnsavedChangesModal } from '../../../src/components/common/UnsavedChangesModal';

const COPY = {
  title: 'Leave with unsaved changes?',
  message: 'You have unsaved changes that will be lost if you leave this page.',
  confirmLabel: 'Leave page',
  cancelLabel: 'Stay on page',
};

function renderModal(overrides: Partial<typeof COPY> = {}, handlers = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <UnsavedChangesModal
      {...COPY}
      {...overrides}
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...handlers}
    />,
  );
  return { onConfirm, onCancel };
}

describe('UnsavedChangesModal (AD10)', () => {
  it('renders the supplied copy and labels', () => {
    renderModal();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /leave with unsaved changes/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Leave page' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stay on page' })).toBeInTheDocument();
  });

  it('reads naturally with the Open-context copy too (same shell)', () => {
    renderModal({
      title: 'Discard unsaved changes?',
      confirmLabel: 'Discard & open',
      cancelLabel: 'Cancel',
    });
    expect(screen.getByRole('button', { name: 'Discard & open' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('confirm label calls onConfirm (the destructive action)', () => {
    const { onConfirm, onCancel } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Leave page' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('cancel label calls onCancel (the safe default)', () => {
    const { onConfirm, onCancel } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Stay on page' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('Escape maps to cancel', () => {
    const { onCancel } = renderModal();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
