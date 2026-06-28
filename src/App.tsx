import { createHashRouter, Navigate, RouterProvider } from 'react-router-dom';
import { LandingPage } from './components/landing/LandingPage';
import { EditorRoute } from './routes/EditorRoute';

// HashRouter (AD7): GitHub Pages is static hosting, so BrowserRouter deep links
// (e.g. /editor) would 404 on refresh. The hash keeps routing fully client-side
// and is invisible to the PWA service worker.
//
// Data router (createHashRouter + RouterProvider) rather than the <HashRouter>
// component (AD10): it unlocks `useBlocker`, which lets the editor intercept
// in-app navigation away from a dirty canvas (e.g. the browser Back button) and
// prompt Stay/Leave. Theming stays per-route — the landing page follows the OS
// (useSystemThemeClass), the editor honors the saved preference (useTheme +
// usePreferencesSync in EditorRoute) — so it is intentionally not hoisted here.
const router = createHashRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/editor', element: <EditorRoute /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export function App() {
  return <RouterProvider router={router} />;
}
