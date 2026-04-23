import type { NodeKind } from '../../core/model/node';

const iconProps = {
  width: 14,
  height: 14,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const KindIcon: Record<NodeKind, () => JSX.Element> = {
  Root: () => (
    <svg {...iconProps}>
      <circle cx="8" cy="8" r="5.5" />
      <circle cx="8" cy="8" r="1.75" fill="currentColor" />
    </svg>
  ),
  Sequence: () => (
    <svg {...iconProps}>
      <path d="M2 8h10" />
      <path d="M9 5l3 3-3 3" />
    </svg>
  ),
  Fallback: () => (
    <svg {...iconProps}>
      <path d="M6 6a2 2 0 114 0c0 1.2-1 1.6-1.5 2S8 9 8 10" />
      <circle cx="8" cy="12.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  ),
  Parallel: () => (
    <svg {...iconProps}>
      <path d="M3 5h10" />
      <path d="M3 8h10" />
      <path d="M3 11h10" />
    </svg>
  ),
  Decorator: () => (
    <svg {...iconProps}>
      <path
        d="M8 1.5L9.2 6.8L14.5 8L9.2 9.2L8 14.5L6.8 9.2L1.5 8L6.8 6.8Z"
        fill="currentColor"
      />
    </svg>
  ),
  Action: () => (
    <svg {...iconProps}>
      <path d="M4 3l9 5-9 5z" fill="currentColor" />
    </svg>
  ),
  Condition: () => (
    <svg {...iconProps}>
      <path d="M5.5 3v10" strokeWidth={2} />
      <path d="M10.5 3v10" strokeWidth={2} />
    </svg>
  ),
  Group: () => (
    <svg {...iconProps}>
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" strokeDasharray="2 1.5" />
    </svg>
  ),
};
