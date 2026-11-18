import type { NodeKind } from '../../core/model/node';
import { KindIcon, type KindIconProps } from './kind-icons';

// 每種類型的靜態視覺設定。與顏色相關的欄位已移到色彩系列系統
// （color-families.ts + usePreferencesSync）；這裡留下的是類型本身的特性：
// 用哪個圖示代表該類型，以及是否使用虛線邊框（只有 Group 使用）。
export interface KindVisual {
  dashed: boolean;
  Icon: (props: KindIconProps) => JSX.Element;
}

// v1.12（AD11）：畫成教科書式符號方框的種類。畫布與匯出圖不顯示它們的名稱，
// 所以搜尋也不比對它們的名稱。Decorator 另外畫成菱形，名稱仍然顯示。
export const SYMBOL_KINDS: ReadonlySet<NodeKind> = new Set(['Sequence', 'Fallback', 'Parallel']);

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
