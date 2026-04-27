import type { NodeKind } from '../../core/model/node';
import { KindIcon } from './kind-icons';

// Static per-kind visuals. Color-related fields moved into the family
// system (color-families.ts + usePreferencesSync) — what's left is the
// kind-intrinsic stuff: which icon represents the kind, and whether it
// gets a dashed border (only Group does).
export interface KindVisual {
  dashed: boolean;
  Icon: () => JSX.Element;
}

export const KIND_VISUALS: Record<NodeKind, KindVisual> = {
  Root:      { dashed: false, Icon: KindIcon.Root },
  Sequence:  { dashed: false, Icon: KindIcon.Sequence },
  Fallback:  { dashed: false, Icon: KindIcon.Fallback },
  Parallel:  { dashed: false, Icon: KindIcon.Parallel },
  Decorator: { dashed: false, Icon: KindIcon.Decorator },
  Action:    { dashed: false, Icon: KindIcon.Action },
  Condition: { dashed: false, Icon: KindIcon.Condition },
  Group:     { dashed: true,  Icon: KindIcon.Group },
};
