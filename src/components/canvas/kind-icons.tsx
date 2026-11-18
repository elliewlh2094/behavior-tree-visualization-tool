import type { NodeKind } from '../../core/model/node';

const iconProps = (size = 14) => ({
  width: size,
  height: size,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export interface KindIconProps {
  size?: number;
}

export const KindIcon: Record<NodeKind, (props: KindIconProps) => JSX.Element> = {
  Root: ({ size }) => (
    <svg {...iconProps(size)}>
      <circle cx="8" cy="8" r="5.5" />
      <circle cx="8" cy="8" r="1.75" fill="currentColor" />
    </svg>
  ),
  Sequence: ({ size }) => (
    <svg {...iconProps(size)}>
      <path d="M2 8h10" />
      <path d="M9 5l3 3-3 3" />
    </svg>
  ),
  Fallback: ({ size }) => (
    <svg {...iconProps(size)}>
      <path d="M6 6a2 2 0 114 0c0 1.2-1 1.6-1.5 2S8 9 8 10" />
      <circle cx="8" cy="12.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  ),
  // ⇉：教科書的 Parallel 符號（兩條平行的右箭頭）。
  Parallel: ({ size }) => (
    <svg {...iconProps(size)}>
      <path d="M2 4.5h11" />
      <path d="M10.5 2l2.5 2.5-2.5 2.5" />
      <path d="M2 11.5h11" />
      <path d="M10.5 9l2.5 2.5-2.5 2.5" />
    </svg>
  ),
  // δ：教科書的 Decorator 符號。以路徑繪製，不依賴字型。
  Decorator: ({ size }) => (
    <svg {...iconProps(size)}>
      <path d="M11.2 3.2C10 2 6 1.8 6 3.6c0 1.6 5.2 2.8 5.2 6.6a3.2 3.2 0 11-6.4 0c0-2 1.6-3.2 3.2-3.4" />
    </svg>
  ),
  Action: ({ size }) => (
    <svg {...iconProps(size)}>
      <path d="M4 3l9 5-9 5z" fill="currentColor" />
    </svg>
  ),
  Condition: ({ size }) => (
    <svg {...iconProps(size)}>
      <path d="M5.5 3v10" strokeWidth={2} />
      <path d="M10.5 3v10" strokeWidth={2} />
    </svg>
  ),
  Group: ({ size }) => (
    <svg {...iconProps(size)}>
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" strokeDasharray="2 1.5" />
    </svg>
  ),
  SubTree: ({ size }) => (
    <svg {...iconProps(size)}>
      <rect x="2" y="2" width="12" height="12" rx="1.5" />
      <rect x="6" y="6" width="4" height="4" rx="0.5" fill="currentColor" />
    </svg>
  ),
};
