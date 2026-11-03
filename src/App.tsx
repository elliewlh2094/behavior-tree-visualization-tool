import { createHashRouter, Navigate, RouterProvider } from 'react-router-dom';
import { LandingPage } from './components/landing/LandingPage';
import { EditorRoute } from './routes/EditorRoute';

// 使用 HashRouter（AD7）：GitHub Pages 是靜態主機，BrowserRouter 的深層連結
// （例如 /editor）在重新整理時會得到 404。hash 讓路由完全在用戶端處理，
// PWA 的 service worker 也看不到它。
//
// 使用 data router（createHashRouter + RouterProvider），而不是 <HashRouter>
// 元件（AD10）：data router 才能使用 `useBlocker`，讓編輯器攔截從 dirty 畫布
// 離開的應用程式內導航（例如瀏覽器的上一頁按鈕），並提示留下／離開。
// 主題依路由劃分：登陸頁跟隨作業系統（useSystemThemeClass），編輯器遵循
// 儲存的偏好（EditorRoute 中的 useTheme + usePreferencesSync），
// 所以刻意不把主題提升到這裡。
const router = createHashRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/editor', element: <EditorRoute /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export function App() {
  return <RouterProvider router={router} />;
}
