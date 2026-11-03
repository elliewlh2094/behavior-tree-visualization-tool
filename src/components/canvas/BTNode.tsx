import type { CSSProperties } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { NodeKind } from '../../core/model/node';
import { NODE_HEIGHT, NODE_WIDTH } from '../../core/config/grid';
import { KIND_VISUALS } from './kind-visuals';
import { nodeVar } from './color-families';
import { useBTStore } from '../../store/bt-store';

export interface BTNodeData extends Record<string, unknown> {
  kind: NodeKind;
  name: string;
  // FR6 搜尋的醒目標示，由 Canvas 從 store 注入。isSearchMatch = 節點名稱
  // 符合查詢字串（綠色外框）；isCurrentMatch = 使用者目前停留的那一個節點
  // （更明顯的綠色外框 + 光暈）。這兩者與依類型著色的選取外框不同，
  // 所以符合項不會被誤認為選取。
  isSearchMatch?: boolean;
  isCurrentMatch?: boolean;
}

const LEAF_KINDS: ReadonlySet<NodeKind> = new Set(['Action', 'Condition', 'SubTree']);

// FR6 搜尋醒目標示。使用品牌／標誌綠色（rgb(0,166,62)），刻意避開
// 各類型的選取色盤，讓兩種狀態在視覺上永遠不會混淆。
const SEARCH_GREEN = '#00a63e';
const SEARCH_GLOW = 'rgba(0, 166, 62, 0.35)';

export function BTNode({ data, selected }: NodeProps) {
  const { kind, name, isSearchMatch, isCurrentMatch } = data as BTNodeData;
  const label = name || kind;
  const isRoot = kind === 'Root';
  const isLeaf = LEAF_KINDS.has(kind);
  const v = KIND_VISUALS[kind];
  // 選取外框是只屬於編輯器的視覺提示，圖片匯出時不應出現在 PNG 中。
  // 因此匯出時隱藏外框（節點與邊框保留），避免被選取的節點在匯出的
  // 圖片中帶著發光的覆蓋層。
  const exporting = useBTStore((s) => s.exportInProgress) !== null;

  // 被選取的節點使用較粗的靜止邊框（border-2）與*選取*色階，
  // 即使使用者把該類型改成低對比的色彩系列，選取狀態仍然清楚可辨。
  const wrapperStyle: CSSProperties = {
    width: NODE_WIDTH,
    // 最小高度為 NODE_HEIGHT（一行）；標籤換成兩行時，節點增加一個格線列，
    // 約為 100px。line-clamp-2 把高度限制在這裡。
    minHeight: NODE_HEIGHT,
    backgroundColor: `var(${nodeVar('bg', kind)})`,
    borderStyle: v.dashed ? 'dashed' : 'solid',
    borderWidth: selected ? 2 : 1,
    borderColor: selected
      ? `var(${nodeVar('borderSelected', kind)})`
      : `var(${nodeVar('border', kind)})`,
  };
  // 把選取外框（內圈，依類型著色）與搜尋外框（外圈綠色帶）組合成單一
  // boxShadow。兩者都是只屬於編輯器的視覺提示，所以圖片匯出時都會隱藏。
  // 選取外框列在前面，讓它位於上層；綠色外框的擴散範圍較大，
  // 所以被選取的符合項會同時顯示類型外框與綠色光暈。
  const selectionRing =
    selected && !exporting ? `0 0 0 2px var(${nodeVar('ring', kind)})` : null;
  const searchRing = exporting
    ? null
    : isCurrentMatch
      ? `0 0 0 3px ${SEARCH_GREEN}, 0 0 0 6px ${SEARCH_GLOW}`
      : isSearchMatch
        ? `0 0 0 3px ${SEARCH_GREEN}`
        : null;
  const boxShadow = [selectionRing, searchRing].filter(Boolean).join(', ');
  const ringStyle: CSSProperties | undefined = boxShadow
    ? { boxShadow }
    : undefined;

  const accentStyle: CSSProperties = {
    color: `var(${nodeVar('accent', kind)})`,
    backgroundColor: `var(${nodeVar('accentBg', kind)})`,
  };

  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg px-3 shadow-subtle text-sm overflow-hidden"
      style={{ ...wrapperStyle, ...ringStyle }}
    >
      {!isRoot && <Handle type="target" position={Position.Top} />}
      <div className="w-full line-clamp-2 break-words text-center font-medium" style={{ color: 'var(--bt-text-primary)' }}>
        {label}
      </div>
      <div
        className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
        style={accentStyle}
      >
        <v.Icon />
        {kind}
      </div>
      {!isLeaf && <Handle type="source" position={Position.Bottom} />}
    </div>
  );
}
