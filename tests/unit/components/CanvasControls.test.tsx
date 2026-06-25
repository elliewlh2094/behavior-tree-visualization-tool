import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// CanvasControls reads the live viewport (useViewport), drives it via
// useReactFlow (fitView/zoomIn/zoomOut/setViewport), reads xyflow's
// interactivity + zoom-limit flags via useStore, toggles them via
// useStoreApi().setState, and opens the SearchBox via the BT store. All of
// these need a ReactFlowProvider/store at runtime, so we mock them and drive
// state directly.
const { mock } = vi.hoisted(() => ({
  mock: {
    viewport: { x: 0, y: 0, zoom: 1 },
    reactFlow: {
      fitView: vi.fn(),
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
      setViewport: vi.fn(),
    },
    flowState: {
      transform: [0, 0, 1] as [number, number, number],
      minZoom: 0.5,
      maxZoom: 2,
      nodesDraggable: true,
      nodesConnectable: true,
      elementsSelectable: true,
    },
    setState: vi.fn(),
    setSearchOpen: vi.fn(),
  },
}));

vi.mock('@xyflow/react', () => ({
  useViewport: () => mock.viewport,
  useReactFlow: () => mock.reactFlow,
  useStore: (selector: (s: typeof mock.flowState) => unknown) =>
    selector(mock.flowState),
  useStoreApi: () => ({ setState: mock.setState }),
}));

vi.mock('../../../src/store/bt-store', () => ({
  useBTStore: (selector: (s: { setSearchOpen: typeof mock.setSearchOpen }) => unknown) =>
    selector({ setSearchOpen: mock.setSearchOpen }),
}));

import { CanvasControls } from '../../../src/components/canvas/CanvasControls';

describe('CanvasControls', () => {
  beforeEach(() => {
    mock.viewport = { x: 0, y: 0, zoom: 1 };
    mock.reactFlow = {
      fitView: vi.fn(),
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
      setViewport: vi.fn(),
    };
    mock.flowState = {
      transform: [0, 0, 1],
      minZoom: 0.5,
      maxZoom: 2,
      nodesDraggable: true,
      nodesConnectable: true,
      elementsSelectable: true,
    };
    mock.setState = vi.fn();
    mock.setSearchOpen = vi.fn();
  });

  it('renders the current zoom as a rounded percentage', () => {
    mock.viewport = { x: 5, y: 6, zoom: 1.5 };
    render(<CanvasControls />);
    expect(
      screen.getByRole('button', { name: /zoom: 150 percent/i }),
    ).toHaveTextContent('150%');
  });

  it('rounds fractional zoom to the nearest whole percent', () => {
    mock.viewport = { x: 0, y: 0, zoom: 0.333 };
    render(<CanvasControls />);
    expect(
      screen.getByRole('button', { name: /zoom: 33 percent/i }),
    ).toHaveTextContent('33%');
  });

  it('clicking the zoom label resets zoom to 1 while preserving x/y', () => {
    mock.viewport = { x: 12, y: 34, zoom: 2 };
    render(<CanvasControls />);
    fireEvent.click(screen.getByRole('button', { name: /zoom: 200 percent/i }));
    expect(mock.reactFlow.setViewport).toHaveBeenCalledWith(
      { x: 12, y: 34, zoom: 1 },
      { duration: 200 },
    );
  });

  it('fit view frames the tree', () => {
    render(<CanvasControls />);
    fireEvent.click(screen.getByRole('button', { name: /fit view/i }));
    expect(mock.reactFlow.fitView).toHaveBeenCalledWith({
      padding: 0.2,
      duration: 200,
    });
  });

  it('zoom in / out call the matching viewport helpers', () => {
    render(<CanvasControls />);
    fireEvent.click(screen.getByRole('button', { name: /zoom in/i }));
    fireEvent.click(screen.getByRole('button', { name: /zoom out/i }));
    expect(mock.reactFlow.zoomIn).toHaveBeenCalledWith({ duration: 200 });
    expect(mock.reactFlow.zoomOut).toHaveBeenCalledWith({ duration: 200 });
  });

  it('disables zoom in at max zoom and zoom out at min zoom', () => {
    mock.flowState.transform = [0, 0, 2]; // == maxZoom
    render(<CanvasControls />);
    expect(screen.getByRole('button', { name: /zoom in/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /zoom out/i })).toBeEnabled();
  });

  it('lock button reflects interactivity and toggles it off on click', () => {
    render(<CanvasControls />);
    const lock = screen.getByRole('button', { name: /lock canvas interactions/i });
    // Interactive → not pressed, labelled "Lock"
    expect(lock).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(lock);
    expect(mock.setState).toHaveBeenCalledWith({
      nodesDraggable: false,
      nodesConnectable: false,
      elementsSelectable: false,
    });
  });

  it('shows the unlock affordance when interactivity is already off', () => {
    mock.flowState.nodesDraggable = false;
    mock.flowState.nodesConnectable = false;
    mock.flowState.elementsSelectable = false;
    render(<CanvasControls />);
    const lock = screen.getByRole('button', { name: /unlock canvas interactions/i });
    expect(lock).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(lock);
    expect(mock.setState).toHaveBeenCalledWith({
      nodesDraggable: true,
      nodesConnectable: true,
      elementsSelectable: true,
    });
  });

  it('search button opens the SearchBox', () => {
    render(<CanvasControls />);
    fireEvent.click(screen.getByRole('button', { name: /search nodes/i }));
    expect(mock.setSearchOpen).toHaveBeenCalledWith(true);
  });
});
