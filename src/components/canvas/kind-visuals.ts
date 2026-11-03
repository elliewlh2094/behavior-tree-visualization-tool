import type { NodeKind } from '../../core/model/node';
import { KindIcon } from './kind-icons';

// 每種類型的靜態視覺設定。與顏色相關的欄位已移到色彩系列系統
// （color-families.ts + usePreferencesSync）；這裡留下的是類型本身的特性：
// 用哪個圖示代表該類型，以及是否使用虛線邊框（只有 Group 使用）。
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
  SubTree:   { dashed: false, Icon: KindIcon.SubTree },
};
