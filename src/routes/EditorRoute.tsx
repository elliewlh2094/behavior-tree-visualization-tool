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

// Restored when the editor unmounts (e.g. navigating back to the landing
// page) so the dirty `● ` / filename title doesn't leak onto other routes.
const BASE_TITLE = 'Behavior Tree Visualizer';

// Copy for the in-app navigation guard (Back to the landing page). Mirrors the
// native beforeunload wording so the two exit paths read the same.
const NAV_DISCARD_COPY = {
  title: 'Leave with unsaved changes?',
  message: 'You have unsaved changes that will be lost if you leave this page.',
  confirmLabel: 'Leave page',
  cancelLabel: 'Stay on page',
};

// The editor shell, served at #/editor. Entering from the landing "Go to
// Editor" CTA (or a direct load) drops straight onto the canvas: the store
// seeds an empty single-Root document, so no intermediate screen is needed.
// Opening an existing file is the Toolbar's "Open" action.
export function EditorRoute() {
  // Editor-only theming: honor the saved preference (Light/Dark/System) and
  // mirror the user's node color families onto :root. Owned here (not in App)
  // so the landing page can follow the OS theme independently.
  useTheme();
  usePreferencesSync();

  // FR9: reflect unsaved state in the tab. `dirty` is derived store-side, so
  // the title, the beforeunload guard, and the in-app nav blocker all read the
  // same source of truth.
  const dirty = useBTStore((s) => s.dirty);
  const fileName = useBTStore((s) => s.fileName);

  // Unsaved-changes guards (AD10). All app-controllable discards funnel through
  // the SAME custom UnsavedChangesModal; only browser close/refresh stays native.
  //   • beforeunload — hard exits (tab close / refresh): native dialog, the one
  //     case that cannot use a custom modal.
  //   • useBlocker — in-app navigation away (e.g. Back to landing), which never
  //     fires beforeunload; pauses the nav so the modal can confirm/cancel it.
  //   • useDiscardGuard — imperative document-replacing actions (Open, and any
  //     future "replace the document" action) routed through the same modal via
  //     the requestDiscard context, replacing the old window.confirm.
  useBeforeUnload(dirty);
  const blocker = useBlocker(dirty);
  const guard = useDiscardGuard();

  useEffect(() => {
    document.title = dirty ? `● ${fileName}` : fileName;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [dirty, fileName]);

  // ReactFlowProvider wraps the whole editor (not just Canvas) so that
  // useReactFlow() hooks in the toolbar — e.g., useApplyLayout's fitView()
  // call — can reach the React Flow instance.
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
        {/* One modal for every app-controllable discard. The router blocker
            (navigation) takes priority over an imperative pending action; they
            can't realistically both be active at once. */}
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
