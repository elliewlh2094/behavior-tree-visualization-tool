import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { toPng } from 'html-to-image';
import { useBTStore, type ExportMode } from '../store/bt-store';
import { captureTargetRef } from '../components/canvas/capture-target';

// 樹外框周圍的留白（flow 單位），讓節點不會緊貼圖片邊緣。
const EXPORT_PADDING = 24;

// Retina／列印品質：PNG 是邏輯像素尺寸的 2 倍（AC1.12）。
const PIXEL_RATIO = 2;

export interface ExportImageOptions {
  mode: ExportMode;
  filename: string;
}

// 從 CSS 自訂屬性讀取目前主題的畫布背景，讓套用主題的匯出結果
// 與使用者正在看的畫面一致（淺色／暗色／自訂）。
function resolveCanvasBackground(): string | undefined {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue('--bt-canvas-bg')
    .trim();
  return value || undefined;
}

function triggerDownload(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * 回傳一個非同步的匯出函式。它切換暫態的 `exportInProgress` 旗標
 * （Canvas／BTNode 讀取這個旗標，以隱藏覆蓋層與選取外框），等待一個
 * 動畫影格讓 React 提交這些移除，然後透過 html-to-image 以整棵樹的邊界
 * 擷取 React Flow 視口。旗標一定在 `finally` 中清除，所以擷取失敗時
 * 編輯器 UI 仍會還原（AC1.14／AC1.15）。找不到畫布或 toPng 失敗時
 * 丟出錯誤，由呼叫端（ExportImageModal）在對話框內顯示訊息。
 */
export function useExportImage(): (opts: ExportImageOptions) => Promise<void> {
  // 使用 hook 提供的 getNodesBounds（而不是獨立匯入的版本），它透過
  // React Flow 內部的 nodeLookup 解析每個節點，所以使用的是*量測後*的寬高。
  // 獨立版本只看得到我們在 Canvas 中建立的使用者端節點（沒有 `measured`
  // 欄位），會把每個節點都算成 0×0，外框因此縮成節點的左上角，
  // 使匯出圖片的右側與底部少了一個節點的寬度／高度。
  const { getNodes, getNodesBounds } = useReactFlow();
  const setExportInProgress = useBTStore((s) => s.setExportInProgress);

  return useCallback(
    async ({ mode, filename }: ExportImageOptions) => {
      const root = captureTargetRef.current;
      const viewport = root?.querySelector<HTMLElement>('.react-flow__viewport');
      if (!viewport) {
        throw new Error('Canvas is not ready');
      }

      setExportInProgress(mode);
      try {
        // 在擷取快照之前，讓 React 繪製覆蓋層與外框的移除。
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );

        const bounds = getNodesBounds(getNodes());
        const width = Math.ceil(bounds.width + EXPORT_PADDING * 2);
        const height = Math.ceil(bounds.height + EXPORT_PADDING * 2);

        // 視口以 flow 座標定位；平移讓樹的左上角在縮放比例 1 時落在
        // (padding, padding)，這樣不論使用者目前的平移／縮放為何，
        // 都能完整取景整棵樹（AC1.9）。
        const themedBackground =
          mode === 'themed' ? resolveCanvasBackground() : undefined;
        const dataUrl = await toPng(viewport, {
          width,
          height,
          pixelRatio: PIXEL_RATIO,
          // 在透明模式下省略這個欄位（而不是設為 undefined），
          // 讓 html-to-image 保留 alpha 通道（AC1.7）。
          ...(themedBackground ? { backgroundColor: themedBackground } : {}),
          style: {
            width: `${width}px`,
            height: `${height}px`,
            transform: `translate(${EXPORT_PADDING - bounds.x}px, ${EXPORT_PADDING - bounds.y}px) scale(1)`,
          },
        });

        triggerDownload(dataUrl, filename);
      } finally {
        setExportInProgress(null);
      }
    },
    [getNodes, setExportInProgress],
  );
}
