// 指向目前 React Flow 根元素（`.react-flow` div）的共用 handle。
// Canvas 透過 `<ReactFlow ref={captureTargetRef}>` 設定它，React 在卸載時
// 清除它；useExportImage（v1.9）讀取它來找到擷取目標。
// 應用程式只渲染一個 Canvas，而匯出 hook 位於 Toolbar 子樹中，
// 也就是在共用的 ReactFlowProvider 下與 Canvas 同層。
// 因此，模組層級的 ref 比跨越這個分支串接 context provider 更簡單。
export const captureTargetRef: { current: HTMLDivElement | null } = {
  current: null,
};
