import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { NodeProps } from '@xyflow/react';

// BTNode renders xyflow <Handle>s, which need a ReactFlowProvider. Mock them
// to nothing so we can render the node in isolation and inspect its styles.
vi.mock('@xyflow/react', async () => {
  const React = await import('react');
  return {
    Handle: () => React.createElement(React.Fragment, null),
    Position: { Top: 'top', Bottom: 'bottom' },
  };
});

import { BTNode } from '../../../src/components/canvas/BTNode';
import { useBTStore } from '../../../src/store/bt-store';

function renderNode(opts: { selected: boolean }) {
  const props = {
    data: { kind: 'Action', name: 'Do thing' },
    selected: opts.selected,
  } as unknown as NodeProps;
  return render(<BTNode {...props} />);
}

describe('BTNode export ring suppression (AC1.11)', () => {
  beforeEach(() => {
    useBTStore.setState({ exportInProgress: null });
  });

  it('selected node shows the selection ring when not exporting', () => {
    const { container } = renderNode({ selected: true });
    const root = container.firstChild as HTMLElement;
    expect(root.style.boxShadow).toContain('2px');
  });

  it('suppresses the selection ring while exportInProgress is set', () => {
    useBTStore.setState({ exportInProgress: 'themed' });
    const { container } = renderNode({ selected: true });
    const root = container.firstChild as HTMLElement;
    expect(root.style.boxShadow).toBe('');
  });

  it('unselected node never has a ring regardless of export state', () => {
    const { container } = renderNode({ selected: false });
    const root = container.firstChild as HTMLElement;
    expect(root.style.boxShadow).toBe('');
  });
});
