import type { NodeKind } from '../../core/model/node';
import { KindIcon } from './kind-icons';

export interface KindVisual {
  // Tailwind class still owns the *static* colors (border, accent, ring).
  // Background is now driven by `bgVar` (a CSS custom property name) so
  // users can recolor per-kind backgrounds at runtime via the preferences
  // store. The previous `bg` Tailwind class is gone — bg flows through
  // inline `style={{ backgroundColor: var(...) }}` everywhere.
  bgVar: string;
  border: string;
  borderSelected: string;
  ring: string;
  accent: string;
  accentBg: string;
  dashed: boolean;
  Icon: () => JSX.Element;
}

export const KIND_VISUALS: Record<NodeKind, KindVisual> = {
  Root: {
    bgVar: '--bt-node-bg-root',
    border: 'border-slate-400',
    borderSelected: 'border-slate-600',
    ring: 'ring-slate-200',
    accent: 'text-slate-600',
    accentBg: 'bg-slate-100',
    dashed: false,
    Icon: KindIcon.Root,
  },
  Sequence: {
    bgVar: '--bt-node-bg-sequence',
    border: 'border-cyan-300',
    borderSelected: 'border-cyan-600',
    ring: 'ring-cyan-200',
    accent: 'text-cyan-700',
    accentBg: 'bg-cyan-100',
    dashed: false,
    Icon: KindIcon.Sequence,
  },
  Fallback: {
    bgVar: '--bt-node-bg-fallback',
    border: 'border-blue-300',
    borderSelected: 'border-blue-600',
    ring: 'ring-blue-200',
    accent: 'text-blue-700',
    accentBg: 'bg-blue-100',
    dashed: false,
    Icon: KindIcon.Fallback,
  },
  Parallel: {
    bgVar: '--bt-node-bg-parallel',
    border: 'border-fuchsia-300',
    borderSelected: 'border-fuchsia-600',
    ring: 'ring-fuchsia-200',
    accent: 'text-fuchsia-700',
    accentBg: 'bg-fuchsia-100',
    dashed: false,
    Icon: KindIcon.Parallel,
  },
  Decorator: {
    bgVar: '--bt-node-bg-decorator',
    border: 'border-orange-300',
    borderSelected: 'border-orange-600',
    ring: 'ring-orange-200',
    accent: 'text-orange-700',
    accentBg: 'bg-orange-100',
    dashed: false,
    Icon: KindIcon.Decorator,
  },
  Action: {
    bgVar: '--bt-node-bg-action',
    border: 'border-emerald-300',
    borderSelected: 'border-emerald-600',
    ring: 'ring-emerald-200',
    accent: 'text-emerald-700',
    accentBg: 'bg-emerald-100',
    dashed: false,
    Icon: KindIcon.Action,
  },
  Condition: {
    bgVar: '--bt-node-bg-condition',
    border: 'border-yellow-300',
    borderSelected: 'border-yellow-600',
    ring: 'ring-yellow-200',
    accent: 'text-yellow-700',
    accentBg: 'bg-yellow-100',
    dashed: false,
    Icon: KindIcon.Condition,
  },
  Group: {
    bgVar: '--bt-node-bg-group',
    border: 'border-slate-400',
    borderSelected: 'border-slate-600',
    ring: 'ring-slate-200',
    accent: 'text-slate-600',
    accentBg: 'bg-slate-100',
    dashed: true,
    Icon: KindIcon.Group,
  },
};
