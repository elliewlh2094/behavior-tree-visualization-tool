import type { NodeKind } from '../../core/model/node';
import { KindIcon } from './kind-icons';

export interface KindVisual {
  bg: string;
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
    bg: 'bg-slate-50',
    border: 'border-slate-400',
    borderSelected: 'border-slate-600',
    ring: 'ring-slate-200',
    accent: 'text-slate-600',
    accentBg: 'bg-slate-100',
    dashed: false,
    Icon: KindIcon.Root,
  },
  Sequence: {
    bg: 'bg-cyan-50',
    border: 'border-cyan-300',
    borderSelected: 'border-cyan-600',
    ring: 'ring-cyan-200',
    accent: 'text-cyan-700',
    accentBg: 'bg-cyan-100',
    dashed: false,
    Icon: KindIcon.Sequence,
  },
  Fallback: {
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    borderSelected: 'border-blue-600',
    ring: 'ring-blue-200',
    accent: 'text-blue-700',
    accentBg: 'bg-blue-100',
    dashed: false,
    Icon: KindIcon.Fallback,
  },
  Parallel: {
    bg: 'bg-fuchsia-50',
    border: 'border-fuchsia-300',
    borderSelected: 'border-fuchsia-600',
    ring: 'ring-fuchsia-200',
    accent: 'text-fuchsia-700',
    accentBg: 'bg-fuchsia-100',
    dashed: false,
    Icon: KindIcon.Parallel,
  },
  Decorator: {
    bg: 'bg-orange-50',
    border: 'border-orange-300',
    borderSelected: 'border-orange-600',
    ring: 'ring-orange-200',
    accent: 'text-orange-700',
    accentBg: 'bg-orange-100',
    dashed: false,
    Icon: KindIcon.Decorator,
  },
  Action: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
    borderSelected: 'border-emerald-600',
    ring: 'ring-emerald-200',
    accent: 'text-emerald-700',
    accentBg: 'bg-emerald-100',
    dashed: false,
    Icon: KindIcon.Action,
  },
  Condition: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-300',
    borderSelected: 'border-yellow-600',
    ring: 'ring-yellow-200',
    accent: 'text-yellow-700',
    accentBg: 'bg-yellow-100',
    dashed: false,
    Icon: KindIcon.Condition,
  },
  Group: {
    bg: 'bg-slate-50',
    border: 'border-slate-400',
    borderSelected: 'border-slate-600',
    ring: 'ring-slate-200',
    accent: 'text-slate-600',
    accentBg: 'bg-slate-100',
    dashed: true,
    Icon: KindIcon.Group,
  },
};
