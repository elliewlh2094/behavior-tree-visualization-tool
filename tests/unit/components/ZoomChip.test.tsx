import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ZoomChip reads the live viewport via xyflow's useViewport() and resets it via
// useReactFlow().setViewport(). Both hooks require a ReactFlowProvider at
// runtime; in a unit test we mock them so we can drive the viewport directly
// and spy on setViewport. ControlButton is mocked to a plain <button> (it
// otherwise needs the provider's store for its disabled state).
const { mock } = vi.hoisted(() => ({
  mock: {
    viewport: { x: 0, y: 0, zoom: 1 },
    setViewport: vi.fn(),
  },
}));

vi.mock('@xyflow/react', async () => {
  const React = await import('react');
  return {
    ControlButton: ({
      children,
      ...props
    }: { children: React.ReactNode } & Record<string, unknown>) =>
      React.createElement('button', props, children),
    useViewport: () => mock.viewport,
    useReactFlow: () => ({ setViewport: mock.setViewport }),
  };
});

import { ZoomChip } from '../../../src/components/canvas/ZoomChip';

describe('ZoomChip', () => {
  beforeEach(() => {
    mock.viewport = { x: 0, y: 0, zoom: 1 };
    mock.setViewport = vi.fn();
  });

  it('renders the current zoom as a rounded percentage (AC5.1)', () => {
    mock.viewport = { x: 5, y: 6, zoom: 1.5 };
    render(<ZoomChip />);
    expect(
      screen.getByRole('button', { name: /zoom: 150 percent/i }),
    ).toHaveTextContent('150%');
  });

  it('rounds fractional zoom to the nearest whole percent', () => {
    mock.viewport = { x: 0, y: 0, zoom: 0.333 };
    render(<ZoomChip />);
    expect(screen.getByRole('button')).toHaveTextContent('33%');
  });

  it('click resets zoom to 1 while preserving x/y (AC5.3)', () => {
    mock.viewport = { x: 12, y: 34, zoom: 2 };
    render(<ZoomChip />);
    fireEvent.click(screen.getByRole('button'));
    expect(mock.setViewport).toHaveBeenCalledWith(
      { x: 12, y: 34, zoom: 1 },
      { duration: 200 },
    );
  });
});
