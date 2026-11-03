import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';
import { ReactFlowProvider } from '@xyflow/react';
import { Canvas } from '../components/canvas/Canvas';
import { NodePalette } from '../components/node-palette/NodePalette';
import { Sidebar } from '../components/sidebar/Sidebar';
import { TabBar } from '../components/tab-bar/TabBar';
import { Toolbar } from '../components/toolbar/Toolbar';
import { ValidationPanel } from '../components/validation/ValidationPanel';
import { UnsavedChangesModal } from '../components/common/UnsavedChangesModal';
import { useBTStore } from '../store/bt-store';
import { useBeforeUnload } from '../hooks/useBeforeUnload';
import { useDiscardGuard } from '../hooks/useDiscardGuard';
import { UnsavedGuardProvider } from '../hooks/useUnsavedGuard';
import { useTheme } from '../hooks/useTheme';
import { usePreferencesSync } from '../hooks/usePreferencesSync';

// 編輯器卸載時（例如導航回登陸頁）還原這個標題，
// 避免 dirty 的 `● ` 與檔名標題殘留到其他路由。
const BASE_TITLE = 'Behavior Tree Visualizer';

// 應用程式內導航守衛（上一頁回到登陸頁）的文案。與原生 beforeunload
// 的用語一致，讓兩種離開路徑的文字相同。
const NAV_DISCARD_COPY = {
  title: 'Leave with unsaved changes?',
  message: 'You have unsaved changes that will be lost if you leave this page.',
  confirmLabel: 'Leave page',
  cancelLabel: 'Stay on page',
};

// 編輯器外殼，位於 #/editor。從登陸頁的 "Go to Editor" CTA 進入
// （或直接載入）時，直接進入畫布：store 預先建立只有一個 Root 的空白文件，
// 所以不需要中間畫面。開啟既有檔案由 Toolbar 的 "Open" 動作負責。
export function EditorRoute() {
  // 只屬於編輯器的主題處理：遵循儲存的偏好（Light／Dark／System），並把
  // 使用者的節點色彩系列同步到 :root。放在這裡（而不是 App），
  // 讓登陸頁可以獨立跟隨作業系統主題。
  useTheme();
  usePreferencesSync();

  // FR9：在分頁標題上反映未存狀態。`dirty` 在 store 端推導，所以標題、
  // beforeunload 守衛與應用程式內導航阻擋器都讀取同一個事實來源。
  const dirty = useBTStore((s) => s.dirty);
  const fileName = useBTStore((s) => s.fileName);

  // 未存變更守衛（AD10）。所有應用程式可控制的捨棄都經過*同一個*自訂
  // UnsavedChangesModal；只有瀏覽器的關閉／重新整理維持原生。
  //   • beforeunload：硬性離開（關閉分頁／重新整理）使用原生對話框，
  //     這是唯一無法使用自訂對話框的情況。
  //   • useBlocker：應用程式內的離開導航（例如上一頁回到登陸頁），這種導航
  //     永遠不會觸發 beforeunload；阻擋器暫停導航，讓對話框確認或取消它。
  //   • useDiscardGuard：命令式的取代文件動作（Open，以及日後任何「取代文件」
  //     的動作），透過 requestDiscard context 經過同一個對話框，
  //     取代舊的 window.confirm。
  useBeforeUnload(dirty);
  const blocker = useBlocker(dirty);
  const guard = useDiscardGuard();

  useEffect(() => {
    document.title = dirty ? `● ${fileName}` : fileName;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [dirty, fileName]);

  // ReactFlowProvider 包住整個編輯器（而不只是 Canvas），讓工具列中的
  // useReactFlow() hooks（例如 useApplyLayout 的 fitView() 呼叫）
  // 能存取 React Flow 實例。
  return (
    <UnsavedGuardProvider value={guard.requestDiscard}>
      <ReactFlowProvider>
        <div className="flex h-screen w-screen flex-col">
          <Toolbar />
          <div className="flex flex-1 overflow-hidden">
            <NodePalette />
            <main className="flex flex-1 flex-col overflow-hidden">
              <TabBar />
              <div className="flex-1 overflow-hidden">
                <Canvas />
              </div>
            </main>
            <Sidebar />
          </div>
          <ValidationPanel />
        </div>
        {/* 所有應用程式可控制的捨棄共用一個對話框。路由阻擋器（導航）
            優先於命令式的待處理動作；實務上兩者不會同時發生。 */}
        {blocker.state === 'blocked' ? (
          <UnsavedChangesModal
            {...NAV_DISCARD_COPY}
            onCancel={() => blocker.reset()}
            onConfirm={() => blocker.proceed()}
          />
        ) : (
          guard.pending && (
            <UnsavedChangesModal
              {...guard.pending.copy}
              onCancel={guard.cancel}
              onConfirm={guard.confirm}
            />
          )
        )}
      </ReactFlowProvider>
    </UnsavedGuardProvider>
  );
}
